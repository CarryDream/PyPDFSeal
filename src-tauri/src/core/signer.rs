use super::models::CertConfig;
use crate::error::{AppError, Result};
use crate::pdf::signature_dict;
use openssl::pkcs7::{Pkcs7, Pkcs7Flags};
use openssl::pkcs12::Pkcs12;
use openssl::pkey::{PKey, Private};
use openssl::stack::Stack;
use openssl::x509::X509;

/// Enough room for common signer certificates and an intermediate chain.
const MAX_CMS_SIG_SIZE: usize = 32 * 1024;

pub fn has_existing_signature(path: &str) -> Result<bool> {
    use std::io::{Read, Seek, SeekFrom};
    let mut file = std::fs::File::open(path).map_err(AppError::Io)?;
    let file_len = file.metadata().map_err(AppError::Io)?.len();

    // Read first 8KB and last 8KB — signatures are typically near the end
    let chunk_size: u64 = 8192;
    let mut buf = Vec::with_capacity(chunk_size as usize * 2);

    let head_read = file_len.min(chunk_size);
    file.by_ref()
        .take(head_read)
        .read_to_end(&mut buf)
        .map_err(AppError::Io)?;

    if file_len > chunk_size {
        let tail_start = file_len.saturating_sub(chunk_size);
        file.seek(SeekFrom::Start(tail_start))
            .map_err(AppError::Io)?;
        file.take(chunk_size)
            .read_to_end(&mut buf)
            .map_err(AppError::Io)?;
    }

    Ok(buf.windows(b"/ByteRange".len()).any(|w| w == b"/ByteRange"))
}

/// Sign a PDF file with a detached PKCS#7 signature.
#[allow(dead_code)]
pub fn sign_pdf(input_path: &str, output_path: &str, cfg: &CertConfig) -> Result<()> {
    if !cfg.enabled || cfg.cert_path.is_empty() {
        std::fs::copy(input_path, output_path).map_err(AppError::Io)?;
        return Ok(());
    }

    let (pkey, cert, chain) = parse_pkcs12(&cfg.cert_path, &cfg.password)?;
    sign_pdf_with_keys(input_path, output_path, &pkey, &cert, &chain, cfg)
}

/// Sign a PDF with pre-parsed PKCS#12 keys (avoids re-parsing cert per file).
pub fn sign_pdf_with_keys(
    input_path: &str,
    output_path: &str,
    pkey: &PKey<Private>,
    cert: &X509,
    chain: &Stack<X509>,
    cfg: &CertConfig,
) -> Result<()> {
    let mut doc = lopdf::Document::load(input_path).map_err(|e| AppError::Pdf(e.to_string()))?;
    let sig_id = signature_dict::inject_signature_dict(
        &mut doc,
        &cfg.reason,
        &cfg.location,
        &cfg.contact,
        MAX_CMS_SIG_SIZE,
    )?
    .0;

    let mut pdf_bytes = Vec::new();
    doc.save_to(&mut pdf_bytes)
        .map_err(|e| AppError::Pdf(e.to_string()))?;
    let positions = find_sig_positions(&pdf_bytes, sig_id)?;
    let contents_start = positions.contents_open;
    let contents_end = positions.contents_close + 1;

    let mut signed_bytes = Vec::with_capacity(pdf_bytes.len() - (contents_end - contents_start));
    signed_bytes.extend_from_slice(&pdf_bytes[..contents_start]);
    signed_bytes.extend_from_slice(&pdf_bytes[contents_end..]);

    let cms_der = build_pkcs7_signature(&pkey, &cert, &chain, &signed_bytes)?;
    let cms_hex = hex_encode(&cms_der);
    let placeholder_len = positions.contents_hex_end - positions.contents_hex_start;
    if cms_hex.len() > placeholder_len {
        return Err(AppError::Signature(format!(
            "CMS signature is too large: {} hex bytes, placeholder has {}",
            cms_hex.len(),
            placeholder_len
        )));
    }

    let mut patched = pdf_bytes;
    patch_byte_range(&mut patched, &positions, contents_start, contents_end)?;
    patch_contents(&mut patched, &positions, cms_hex.as_bytes());
    std::fs::write(output_path, &patched).map_err(AppError::Io)?;

    Ok(())
}

pub fn parse_pkcs12(path: &str, password: &str) -> Result<(PKey<Private>, X509, Stack<X509>)> {
    let pfx_bytes = std::fs::read(path).map_err(AppError::Io)?;
    let pkcs12 = Pkcs12::from_der(&pfx_bytes)
        .map_err(|e| AppError::Signature(format!("PKCS#12 parse error: {}", e)))?;
    let parsed = pkcs12
        .parse2(password)
        .map_err(|e| AppError::Signature(format!("PKCS#12 decrypt error: {}", e)))?;

    let pkey = parsed
        .pkey
        .ok_or_else(|| AppError::Signature("No private key in PKCS#12".into()))?;
    let cert = parsed
        .cert
        .ok_or_else(|| AppError::Signature("No certificate in PKCS#12".into()))?;
    let chain = match parsed.ca {
        Some(chain) => chain,
        None => {
            Stack::new().map_err(|e| AppError::Signature(format!("OpenSSL stack error: {}", e)))?
        }
    };

    Ok((pkey, cert, chain))
}

fn build_pkcs7_signature(
    pkey: &PKey<Private>,
    cert: &X509,
    chain: &Stack<X509>,
    signed_bytes: &[u8],
) -> Result<Vec<u8>> {
    let flags = Pkcs7Flags::DETACHED | Pkcs7Flags::BINARY;
    let pkcs7 = Pkcs7::sign(cert, pkey, chain, signed_bytes, flags)
        .map_err(|e| AppError::Signature(format!("PKCS#7 sign error: {}", e)))?;
    pkcs7
        .to_der()
        .map_err(|e| AppError::Signature(format!("PKCS#7 DER encode error: {}", e)))
}

#[derive(Debug)]
struct SignaturePositions {
    byte_range_start: usize,
    byte_range_end: usize,
    contents_open: usize,
    contents_hex_start: usize,
    contents_hex_end: usize,
    contents_close: usize,
}

fn find_sig_positions(pdf_bytes: &[u8], sig_id: lopdf::ObjectId) -> Result<SignaturePositions> {
    let obj_marker = format!("{} {} obj", sig_id.0, sig_id.1);
    let obj_start = find_bytes(pdf_bytes, obj_marker.as_bytes(), 0)
        .ok_or_else(|| AppError::Signature("signature object not found in PDF bytes".into()))?;
    let obj_end = find_bytes(pdf_bytes, b"endobj", obj_start)
        .ok_or_else(|| AppError::Signature("signature object end not found".into()))?;
    let sig_slice = &pdf_bytes[obj_start..obj_end];

    let br_marker = b"/ByteRange";
    let br_pos = find_bytes(sig_slice, br_marker, 0)
        .map(|pos| obj_start + pos)
        .ok_or_else(|| AppError::Signature("ByteRange not found in signature object".into()))?;
    let byte_range_start = find_bytes(pdf_bytes, b"[", br_pos + br_marker.len())
        .ok_or_else(|| AppError::Signature("ByteRange array start not found".into()))?;
    let byte_range_end = find_bytes(pdf_bytes, b"]", byte_range_start)
        .map(|pos| pos + 1)
        .ok_or_else(|| AppError::Signature("ByteRange array end not found".into()))?;

    let ct_marker = b"/Contents";
    let ct_pos = find_bytes(sig_slice, ct_marker, 0)
        .map(|pos| obj_start + pos)
        .ok_or_else(|| AppError::Signature("Contents not found in signature object".into()))?;
    let contents_open = find_bytes(pdf_bytes, b"<", ct_pos + ct_marker.len())
        .ok_or_else(|| AppError::Signature("Contents hex start not found".into()))?;
    let contents_close = find_bytes(pdf_bytes, b">", contents_open + 1)
        .ok_or_else(|| AppError::Signature("Contents hex end not found".into()))?;

    if contents_close > obj_end {
        return Err(AppError::Signature(
            "signature Contents hex string extends past signature object".into(),
        ));
    }

    Ok(SignaturePositions {
        byte_range_start,
        byte_range_end,
        contents_open,
        contents_hex_start: contents_open + 1,
        contents_hex_end: contents_close,
        contents_close,
    })
}

fn patch_byte_range(
    patched: &mut [u8],
    positions: &SignaturePositions,
    contents_start: usize,
    contents_end: usize,
) -> Result<()> {
    let byte_range = format!(
        "[0 {} {} {}]",
        contents_start,
        contents_end,
        patched.len() - contents_end
    );
    let target_len = positions.byte_range_end - positions.byte_range_start;
    if byte_range.len() > target_len {
        return Err(AppError::Signature(format!(
            "ByteRange placeholder too small: need {}, have {}",
            byte_range.len(),
            target_len
        )));
    }

    patched[positions.byte_range_start..positions.byte_range_end].fill(b' ');
    patched[positions.byte_range_start..positions.byte_range_start + byte_range.len()]
        .copy_from_slice(byte_range.as_bytes());
    Ok(())
}

fn patch_contents(patched: &mut [u8], positions: &SignaturePositions, cms_hex: &[u8]) {
    patched[positions.contents_hex_start..positions.contents_hex_end].fill(b'0');
    patched[positions.contents_hex_start..positions.contents_hex_start + cms_hex.len()]
        .copy_from_slice(cms_hex);
}

fn find_bytes(haystack: &[u8], needle: &[u8], start: usize) -> Option<usize> {
    haystack
        .get(start..)?
        .windows(needle.len())
        .position(|window| window == needle)
        .map(|pos| start + pos)
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02X}", b)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn contents_patch_preserves_hex_string_delimiters() {
        let mut bytes = b"/Contents <00000000>".to_vec();
        let positions = SignaturePositions {
            byte_range_start: 0,
            byte_range_end: 0,
            contents_open: 10,
            contents_hex_start: 11,
            contents_hex_end: 19,
            contents_close: 19,
        };

        patch_contents(&mut bytes, &positions, b"A1B2");
        assert_eq!(&bytes, b"/Contents <A1B20000>");
    }
}
