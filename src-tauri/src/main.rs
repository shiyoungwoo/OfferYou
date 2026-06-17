#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::net::TcpStream;
use std::time::{Duration, Instant};
use tauri::{Manager, State};

struct ServerProcess(Mutex<Option<Child>>);

const DEFAULT_DESKTOP_PORT: u16 = 3100;

fn desktop_port() -> u16 {
    std::env::var("OFFERYOU_DESKTOP_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(DEFAULT_DESKTOP_PORT)
}

fn is_server_ready(port: u16) -> bool {
    TcpStream::connect_timeout(
        &format!("127.0.0.1:{port}").parse().unwrap(),
        Duration::from_millis(500),
    )
    .is_ok()
}

fn start_local_server(app_data_dir: &std::path::Path, workspace_dir: &str) -> Option<Child> {
    let port = desktop_port();

    if is_server_ready(port) {
        return None; // Already running
    }

    let storage_dir = app_data_dir.join("storage");
    let log_dir = app_data_dir.join("logs");
    std::fs::create_dir_all(&storage_dir).ok();
    std::fs::create_dir_all(&log_dir).ok();

    let node_bin = std::env::var("OFFERYOU_NODE_BIN")
        .unwrap_or_else(|_| "/opt/homebrew/bin/node".to_string());
    let pnpm_bin = std::env::var("OFFERYOU_PNPM_BIN")
        .unwrap_or_else(|_| "/opt/homebrew/bin/pnpm".to_string());

    let script = format!("{}/scripts/desktop/start-next-server.mjs", workspace_dir);

    let child = Command::new(&node_bin)
        .arg(&script)
        .arg("--workspace")
        .arg(workspace_dir)
        .arg("--pnpm-bin")
        .arg(&pnpm_bin)
        .arg("--port")
        .arg(port.to_string())
        .env("OFFERYOU_DESKTOP", "1")
        .env("OFFERYOU_DESKTOP_PORT", port.to_string())
        .env("OFFERYOU_STORAGE_DIR", storage_dir.to_string_lossy().to_string())
        .env("OFFERYOU_CLI_CWD", workspace_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .ok();

    // Wait for server to be ready (up to 30s)
    if child.is_some() {
        let start = Instant::now();
        while start.elapsed() < Duration::from_secs(30) {
            if is_server_ready(port) {
                break;
            }
            std::thread::sleep(Duration::from_millis(500));
        }
    }

    child
}

#[tauri::command]
fn get_storage_dir(app: tauri::AppHandle) -> String {
    let dir = app.path().app_data_dir().unwrap_or_default().join("storage");
    dir.to_string_lossy().to_string()
}

fn main() {
    tauri::Builder::default()
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().unwrap_or_default();
            let workspace_dir = std::env::var("OFFERYOU_CLI_CWD")
                .unwrap_or_else(|_| "/Users/wsyoung/Projects/OfferYou/github_release".to_string());

            if let Some(child) = start_local_server(&app_data_dir, &workspace_dir) {
                let state: State<ServerProcess> = app.state();
                *state.0.lock().unwrap() = Some(child);
            }

            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Server cleanup happens via Drop
            }
        })
        .invoke_handler(tauri::generate_handler![get_storage_dir])
        .run(tauri::generate_context!())
        .expect("error while running OfferYou desktop");
}

impl Drop for ServerProcess {
    fn drop(&mut self) {
        if let Some(mut child) = self.0.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}
