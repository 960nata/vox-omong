use rusqlite::{params, Connection};
use serde::Serialize;
use std::fs;
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, State};
use walkdir::WalkDir;

struct ServerProcess(Mutex<Option<Child>>);

struct SqliteState {
    db_path: PathBuf,
}

#[derive(Serialize)]
struct ScannedFile {
    path: String,
    is_dir: bool,
    size: u64,
}

#[derive(Serialize)]
struct SearchHit {
    path: String,
    line: usize,
    preview: String,
}

#[derive(Serialize)]
struct SystemInfo {
    backend: &'static str,
    version: &'static str,
    data_dir: String,
    db_path: String,
}

const SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    "target",
    "dist-desktop",
    ".vox-desktop",
    "__pycache__",
    ".venv",
];

fn should_skip(name: &str) -> bool {
    name.starts_with('.') || SKIP_DIRS.contains(&name)
}

#[tauri::command]
fn vox_system_info(app: tauri::AppHandle, sqlite: State<SqliteState>) -> SystemInfo {
    let data_dir = app
        .path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    SystemInfo {
        backend: "tauri-rust-v2",
        version: env!("CARGO_PKG_VERSION"),
        data_dir,
        db_path: sqlite.db_path.to_string_lossy().to_string(),
    }
}

/// Pemindai folder proyek super cepat berbasis Rust (`walkdir`).
#[tauri::command]
fn vox_scan_files(root_dir: String, max_files: Option<usize>) -> Result<Vec<ScannedFile>, String> {
    let root = PathBuf::from(&root_dir);
    if !root.exists() {
        return Err(format!("Folder tidak ditemukan: {}", root_dir));
    }
    let limit = max_files.unwrap_or(5000);
    let mut results = Vec::new();

    let walker = WalkDir::new(&root)
        .max_depth(8)
        .into_iter()
        .filter_entry(|e| {
            if e.depth() == 0 {
                return true;
            }
            let name = e.file_name().to_string_lossy();
            !should_skip(&name)
        });

    for entry in walker.flatten() {
        if entry.depth() == 0 {
            continue;
        }
        let rel = entry
            .path()
            .strip_prefix(&root)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();
        if rel.is_empty() {
            continue;
        }
        let is_dir = entry.file_type().is_dir();
        let size = if is_dir {
            0
        } else {
            entry.metadata().map(|m| m.len()).unwrap_or(0)
        };
        results.push(ScannedFile {
            path: rel,
            is_dir,
            size,
        });
        if results.len() >= limit {
            break;
        }
    }
    Ok(results)
}

/// Pencarian kode cepat di folder proyek menggunakan Rust.
#[tauri::command]
fn vox_search_code(
    root_dir: String,
    query: String,
    max_results: Option<usize>,
) -> Result<Vec<SearchHit>, String> {
    let root = PathBuf::from(&root_dir);
    if !root.exists() {
        return Err(format!("Folder tidak ditemukan: {}", root_dir));
    }
    let needle = query.trim().to_lowercase();
    if needle.is_empty() {
        return Ok(Vec::new());
    }
    let limit = max_results.unwrap_or(80);
    let mut hits = Vec::new();

    let walker = WalkDir::new(&root)
        .max_depth(8)
        .into_iter()
        .filter_entry(|e| {
            if e.depth() == 0 {
                return true;
            }
            let name = e.file_name().to_string_lossy();
            !should_skip(&name)
        });

    for entry in walker.flatten() {
        if entry.file_type().is_dir() {
            continue;
        }
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if meta.len() > 512_000 {
            continue;
        }
        let content = match fs::read_to_string(entry.path()) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let rel = entry
            .path()
            .strip_prefix(&root)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();

        for (idx, line) in content.lines().enumerate() {
            if line.to_lowercase().contains(&needle) {
                let preview: String = line.trim().chars().take(180).collect();
                hits.push(SearchHit {
                    path: rel.clone(),
                    line: idx + 1,
                    preview,
                });
                if hits.len() >= limit {
                    return Ok(hits);
                }
            }
        }
    }
    Ok(hits)
}

fn init_sqlite(db_path: &Path) -> Result<(), String> {
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         CREATE TABLE IF NOT EXISTS vox_kv (
           key TEXT PRIMARY KEY,
           value TEXT NOT NULL,
           updated_at TEXT NOT NULL DEFAULT (datetime('now'))
         );",
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn vox_sqlite_get(key: String, sqlite: State<SqliteState>) -> Result<Option<String>, String> {
    let conn = Connection::open(&sqlite.db_path).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT value FROM vox_kv WHERE key = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![key]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let val: String = row.get(0).map_err(|e| e.to_string())?;
        Ok(Some(val))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn vox_sqlite_set(key: String, value: String, sqlite: State<SqliteState>) -> Result<bool, String> {
    let conn = Connection::open(&sqlite.db_path).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO vox_kv (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(true)
}

fn pick_free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .unwrap_or(3499)
}

fn wait_for_port(port: u16, timeout: Duration) -> bool {
    let addr: SocketAddr = ([127, 0, 0, 1], port).into();
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    false
}

fn find_node_binary() -> String {
    for candidate in [
        "/usr/local/bin/node",
        "/opt/homebrew/bin/node",
        "/usr/bin/node",
    ] {
        if Path::new(candidate).exists() {
            return candidate.to_string();
        }
    }
    "node".to_string()
}

fn resolve_server_paths(app: &tauri::AppHandle) -> Option<(PathBuf, PathBuf)> {
    if let Ok(res_dir) = app.path().resource_dir() {
        let entry = res_dir.join("server").join("server.js");
        let launcher = res_dir.join("launch-server.cjs");
        if entry.exists() && launcher.exists() {
            return Some((launcher, entry));
        }
    }
    None
}

fn sync_user_env_if_missing(data_dir: &Path) {
    let target_env = data_dir.join(".env");
    if target_env.exists() {
        return;
    }
    if let Some(home) = std::env::var_os("HOME") {
        let legacy = PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("VOX·AI Studio")
            .join(".env");
        if legacy.exists() {
            let _ = fs::create_dir_all(data_dir);
            let _ = fs::copy(legacy, target_env);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(ServerProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            vox_system_info,
            vox_scan_files,
            vox_search_code,
            vox_sqlite_get,
            vox_sqlite_set,
        ])
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("vox-ai-studio"));
            let _ = fs::create_dir_all(&data_dir);
            sync_user_env_if_missing(&data_dir);

            let db_path = data_dir.join("vox_local.db");
            let _ = init_sqlite(&db_path);
            app.manage(SqliteState { db_path });

            // Bangun menu bar native
            let chat_baru = MenuItem::with_id(app, "chat-baru", "Chat Baru", true, Some("CmdOrCtrl+N"))?;
            let pengaturan = MenuItem::with_id(app, "pengaturan", "Pengaturan…", true, Some("CmdOrCtrl+,"))?;
            let cari = MenuItem::with_id(app, "cari", "Cari / Sidebar", true, Some("CmdOrCtrl+F"))?;
            let reload = MenuItem::with_id(app, "reload", "Muat Ulang", true, Some("CmdOrCtrl+R"))?;

            let app_menu = Submenu::with_items(
                app,
                "VOX·AI Studio",
                true,
                &[
                    &PredefinedMenuItem::about(app, Some("Tentang VOX·AI Studio"), None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &pengaturan,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, Some("Sembunyikan"))?,
                    &PredefinedMenuItem::quit(app, Some("Keluar"))?,
                ],
            )?;

            let file_menu = Submenu::with_items(
                app,
                "Berkas",
                true,
                &[&chat_baru, &cari, &PredefinedMenuItem::close_window(app, Some("Tutup Jendela"))?],
            )?;

            let edit_menu = Submenu::with_items(
                app,
                "Ubah",
                true,
                &[
                    &PredefinedMenuItem::undo(app, Some("Urungkan"))?,
                    &PredefinedMenuItem::redo(app, Some("Ulangi"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, Some("Potong"))?,
                    &PredefinedMenuItem::copy(app, Some("Salin"))?,
                    &PredefinedMenuItem::paste(app, Some("Tempel"))?,
                    &PredefinedMenuItem::select_all(app, Some("Pilih Semua"))?,
                ],
            )?;

            let view_menu = Submenu::with_items(app, "Tampilan", true, &[&reload])?;
            let menu = Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu, &view_menu])?;
            app.set_menu(menu)?;

            app.on_menu_event(|app_handle, event| {
                let id = event.id().as_ref();
                if id == "reload" {
                    if let Some(win) = app_handle.get_webview_window("main") {
                        let _ = win.eval("window.location.reload()");
                    }
                    return;
                }
                let _ = app_handle.emit("vox:menu", id);
            });

            // Tray icon native
            let show_item = MenuItem::with_id(app, "tray-show", "Buka VOX·AI Studio", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "tray-quit", "Keluar", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;
            let _tray = TrayIconBuilder::new()
                .menu(&tray_menu)
                .tooltip("VOX·AI Studio")
                .on_menu_event(|app_handle, event| match event.id().as_ref() {
                    "tray-show" => {
                        if let Some(win) = app_handle.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "tray-quit" => {
                        app_handle.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            // Di build rilis (bundled), nyalakan standalone server lokal dan arahkan webview ke sana.
            if !cfg!(debug_assertions) {
                if let Some((launcher, entry)) = resolve_server_paths(app.handle()) {
                    let port = pick_free_port();
                    let node_bin = find_node_binary();
                    let child = Command::new(node_bin)
                        .arg(launcher)
                        .current_dir(&data_dir)
                        .env("VOX_SERVER_ENTRY", entry)
                        .env("VOX_DATA_ROOT", &data_dir)
                        .env("NODE_ENV", "production")
                        .env("HOSTNAME", "127.0.0.1")
                        .env("PORT", port.to_string())
                        .stdout(Stdio::null())
                        .stderr(Stdio::null())
                        .spawn();

                    if let Ok(proc_child) = child {
                        if let Ok(mut guard) = app.state::<ServerProcess>().0.lock() {
                            *guard = Some(proc_child);
                        }
                        let handle = app.handle().clone();
                        std::thread::spawn(move || {
                            if wait_for_port(port, Duration::from_secs(30)) {
                                if let Some(win) = handle.get_webview_window("main") {
                                    let url = format!("http://127.0.0.1:{}", port);
                                    let _ = win.eval(&format!("window.location.replace('{}')", url));
                                }
                            }
                        });
                    }
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building VOX·AI Studio");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Ok(mut guard) = app_handle.state::<ServerProcess>().0.lock() {
                if let Some(mut child) = guard.take() {
                    let _ = child.kill();
                }
            }
        }
    });
}
