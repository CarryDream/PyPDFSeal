use rusqlite::{Connection, params};
use std::path::Path;
use std::sync::Mutex;

use crate::error::Result;

pub struct Database {
    conn: Mutex<Connection>,
}

#[derive(Debug, serde::Serialize, Clone)]
pub struct BatchFileRow {
    pub id: i64,
    pub batch_run_id: Option<i64>,
    pub file_path: String,
    pub status: String,
    pub output_path: Option<String>,
    pub error_message: Option<String>,
    pub processing_time_ms: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, serde::Serialize)]
pub struct BatchFilesPage {
    pub items: Vec<BatchFileRow>,
    pub total: u32,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Debug, serde::Deserialize)]
pub struct BatchRunSummary {
    pub total: u32,
    pub succeeded: u32,
    pub failed: u32,
    pub skipped: u32,
    pub cancelled: u32,
    pub elapsed_ms: u64,
}

impl Database {
    pub fn open(data_dir: &Path) -> Result<Self> {
        std::fs::create_dir_all(data_dir).ok();
        let db_path = data_dir.join("db.sqlite");
        let conn = Connection::open(db_path)?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS config (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS batch_runs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at  TEXT NOT NULL,
                finished_at TEXT,
                total       INTEGER NOT NULL DEFAULT 0,
                succeeded   INTEGER NOT NULL DEFAULT 0,
                failed      INTEGER NOT NULL DEFAULT 0,
                skipped     INTEGER NOT NULL DEFAULT 0,
                cancelled   INTEGER NOT NULL DEFAULT 0,
                elapsed_ms  INTEGER
            );

            CREATE TABLE IF NOT EXISTS batch_files (
                id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_run_id       INTEGER,
                file_path          TEXT NOT NULL,
                status             TEXT NOT NULL DEFAULT 'pending',
                output_path        TEXT,
                error_message      TEXT,
                processing_time_ms INTEGER,
                created_at         TEXT NOT NULL,
                FOREIGN KEY (batch_run_id) REFERENCES batch_runs(id)
            );",
        )?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    // ======================== Config ========================

    pub fn get_config(&self) -> Result<std::collections::HashMap<String, String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT key, value FROM config")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut map = std::collections::HashMap::new();
        for row in rows {
            let (k, v) = row?;
            map.insert(k, v);
        }
        Ok(map)
    }

    pub fn set_config_batch(&self, entries: &[(String, String)]) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let tx = conn.unchecked_transaction()?;
        {
            let mut stmt =
                tx.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?1, ?2)")?;
            for (key, value) in entries {
                stmt.execute(params![key, value])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    // ======================== Batch files ========================

    pub fn clear_history(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM batch_files", [])?;
        conn.execute("DELETE FROM batch_runs", [])?;
        Ok(())
    }

    pub fn import_files(&self, files: &[String]) -> Result<Vec<i64>> {
        let conn = self.conn.lock().unwrap();
        let tx = conn.unchecked_transaction()?;
        let now = chrono_now();
        let mut ids = Vec::with_capacity(files.len());
        {
            let mut stmt = tx.prepare(
                "INSERT INTO batch_files (file_path, status, created_at) VALUES (?1, 'pending', ?2)",
            )?;
            for file in files {
                let id = stmt.insert(params![file, now])?;
                ids.push(id);
            }
        }
        tx.commit()?;
        Ok(ids)
    }

    pub fn remove_file(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM batch_files WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn create_batch_run(&self) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let now = chrono_now();
        conn.execute(
            "INSERT INTO batch_runs (started_at, total) VALUES (?1, 0)",
            params![now],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn set_batch_run_total(&self, run_id: i64, total: u32) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE batch_runs SET total = ?1 WHERE id = ?2",
            params![total as i64, run_id],
        )?;
        Ok(())
    }

    pub fn assign_files_to_run(&self, run_id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE batch_files SET batch_run_id = ?1 WHERE batch_run_id IS NULL",
            params![run_id],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn update_file_status(
        &self,
        id: i64,
        status: &str,
        output_path: Option<&str>,
        error_message: Option<&str>,
        processing_time_ms: Option<i64>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE batch_files SET status = ?1, output_path = ?2, error_message = ?3, processing_time_ms = ?4 WHERE id = ?5",
            params![status, output_path, error_message, processing_time_ms, id],
        )?;
        Ok(())
    }

    pub fn update_files_status_batch(
        &self,
        entries: &[(i64, &str, Option<&str>, Option<&str>, Option<i64>)],
    ) -> Result<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        for &(id, status, output_path, error_message, processing_time_ms) in entries {
            tx.execute(
                "UPDATE batch_files SET status = ?1, output_path = ?2, error_message = ?3, processing_time_ms = ?4 WHERE id = ?5",
                params![status, output_path, error_message, processing_time_ms, id],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn finish_batch_run(&self, run_id: i64, summary: &BatchRunSummary) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono_now();
        conn.execute(
            "UPDATE batch_runs SET finished_at = ?1, total = ?2, succeeded = ?3, failed = ?4, skipped = ?5, cancelled = ?6, elapsed_ms = ?7 WHERE id = ?8",
            params![
                now,
                summary.total,
                summary.succeeded,
                summary.failed,
                summary.skipped,
                summary.cancelled,
                summary.elapsed_ms as i64,
                run_id,
            ],
        )?;
        Ok(())
    }

    pub fn get_files_page(
        &self,
        page: u32,
        page_size: u32,
        status_filter: Option<&str>,
    ) -> Result<BatchFilesPage> {
        let conn = self.conn.lock().unwrap();

        let (count_sql, query_sql, has_filter) = if status_filter.is_some() {
            (
                "SELECT COUNT(*) FROM batch_files WHERE status = ?1".to_string(),
                "SELECT id, batch_run_id, file_path, status, output_path, error_message, processing_time_ms, created_at FROM batch_files WHERE status = ?1 ORDER BY id LIMIT ?2 OFFSET ?3".to_string(),
                true,
            )
        } else {
            (
                "SELECT COUNT(*) FROM batch_files WHERE batch_run_id IS NOT NULL".to_string(),
                "SELECT id, batch_run_id, file_path, status, output_path, error_message, processing_time_ms, created_at FROM batch_files WHERE batch_run_id IS NOT NULL ORDER BY id LIMIT ?1 OFFSET ?2".to_string(),
                false,
            )
        };

        let total: u32 = if has_filter {
            conn.query_row(&count_sql, params![status_filter.unwrap()], |row| {
                row.get(0)
            })?
        } else {
            conn.query_row(&count_sql, [], |row| row.get(0))?
        };

        let offset = (page.saturating_sub(1)) * page_size;
        let mut stmt = conn.prepare(&query_sql)?;

        let rows = if has_filter {
            stmt.query_map(
                params![status_filter.unwrap(), page_size, offset],
                map_file_row,
            )?
        } else {
            stmt.query_map(params![page_size, offset], map_file_row)?
        };

        let mut items = Vec::new();
        for row in rows {
            items.push(row?);
        }

        Ok(BatchFilesPage {
            items,
            total,
            page,
            page_size,
        })
    }

    pub fn get_all_files_for_export(&self) -> Result<Vec<BatchFileRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, batch_run_id, file_path, status, output_path, error_message, processing_time_ms, created_at FROM batch_files ORDER BY id",
        )?;
        let rows = stmt.query_map([], map_file_row)?;
        let mut items = Vec::new();
        for row in rows {
            items.push(row?);
        }
        Ok(items)
    }

    // ======================== Excel export ========================

    pub fn export_to_xlsx(&self, path: &str) -> Result<()> {
        let files = self.get_all_files_for_export()?;

        use rust_xlsxwriter::Workbook;
        let mut workbook = Workbook::new();
        let sheet = workbook.add_worksheet();

        // Header
        let headers = ["ID", "文件路径", "状态", "输出路径", "错误信息", "耗时(ms)"];
        let bold = rust_xlsxwriter::Format::new().set_bold();
        for (col, header) in headers.iter().enumerate() {
            sheet
                .write_string_with_format(0, col as u16, *header, &bold)
                .map_err(|e| crate::error::AppError::Export(e.to_string()))?;
        }

        // Data rows
        for (i, file) in files.iter().enumerate() {
            let row = (i as u32) + 1;
            sheet
                .write_number(row, 0, file.id as f64)
                .map_err(|e| crate::error::AppError::Export(e.to_string()))?;
            sheet
                .write_string(row, 1, &file.file_path)
                .map_err(|e| crate::error::AppError::Export(e.to_string()))?;
            sheet
                .write_string(row, 2, &file.status)
                .map_err(|e| crate::error::AppError::Export(e.to_string()))?;
            sheet
                .write_string(row, 3, file.output_path.as_deref().unwrap_or(""))
                .map_err(|e| crate::error::AppError::Export(e.to_string()))?;
            sheet
                .write_string(row, 4, file.error_message.as_deref().unwrap_or(""))
                .map_err(|e| crate::error::AppError::Export(e.to_string()))?;
            if let Some(ms) = file.processing_time_ms {
                sheet
                    .write_number(row, 5, ms as f64)
                    .map_err(|e| crate::error::AppError::Export(e.to_string()))?;
            }
        }

        workbook
            .save(path)
            .map_err(|e| crate::error::AppError::Export(e.to_string()))?;
        Ok(())
    }
}

fn map_file_row(row: &rusqlite::Row) -> rusqlite::Result<BatchFileRow> {
    Ok(BatchFileRow {
        id: row.get(0)?,
        batch_run_id: row.get(1)?,
        file_path: row.get(2)?,
        status: row.get(3)?,
        output_path: row.get(4)?,
        error_message: row.get(5)?,
        processing_time_ms: row.get(6)?,
        created_at: row.get(7)?,
    })
}

fn chrono_now() -> String {
    // Use simple timestamp without pulling in chrono crate
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    // Simple ISO-8601-ish: YYYY-MM-DD HH:MM:SS
    let days = secs / 86400;
    let time_of_day = secs % 86400;
    let h = time_of_day / 3600;
    let m = (time_of_day % 3600) / 60;
    let s = time_of_day % 60;

    // Days since epoch to Y-M-D (simplified leap year calculation)
    let mut y = 1970;
    let mut remaining = days;
    loop {
        let days_in_year = if is_leap(y) { 366 } else { 365 };
        if remaining < days_in_year {
            break;
        }
        remaining -= days_in_year;
        y += 1;
    }
    let leap = is_leap(y);
    let month_days: [u64; 12] = [
        31,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    let mut mo = 0;
    for (i, &d) in month_days.iter().enumerate() {
        if remaining < d {
            mo = i + 1;
            break;
        }
        remaining -= d;
    }
    let d = remaining + 1;

    format!("{y:04}-{mo:02}-{d:02} {h:02}:{m:02}:{s:02}")
}

fn is_leap(y: u64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}
