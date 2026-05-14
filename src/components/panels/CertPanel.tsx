import { open } from "@tauri-apps/plugin-dialog";
import { useConfigStore } from "../../store/configStore";

export default function CertPanel() {
  const { cert, setCert } = useConfigStore();

  const handleSelectCert = async () => {
    const selected = await open({
      filters: [{ name: "证书", extensions: ["pfx", "p12"] }],
    });
    if (selected) {
      setCert({ cert_path: selected as string });
    }
  };

  return (
    <div className="panel cert-panel">
      <h3>数字签名</h3>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={cert.enabled}
          onChange={(e) => setCert({ enabled: e.target.checked })}
        />
        启用签名
      </label>

      {cert.enabled && (
        <>
          <label>证书文件 (.pfx/.p12)</label>
          <div className="row">
            <input type="text" value={cert.cert_path} readOnly placeholder="选择证书..." />
            <button onClick={handleSelectCert}>选择</button>
          </div>

          <label>密码</label>
          <input
            type="password"
            value={cert.password}
            onChange={(e) => setCert({ password: e.target.value })}
          />

          <label>签名原因</label>
          <input
            type="text"
            value={cert.reason}
            onChange={(e) => setCert({ reason: e.target.value })}
            placeholder="例: 批准"
          />

          <label>签名地点</label>
          <input
            type="text"
            value={cert.location}
            onChange={(e) => setCert({ location: e.target.value })}
          />

          <label>联系方式</label>
          <input
            type="text"
            value={cert.contact}
            onChange={(e) => setCert({ contact: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
