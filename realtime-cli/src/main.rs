use clap::Parser;

mod cli;
mod consolidator;
mod file_watcher;
mod launcher;
mod panel_server;
mod scanner;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = cli::CliArgs::parse();
    let work_dir = cli::resolve_work_dir(args.directory.as_deref())?;

    println!("Real Time — One-Click Experience");
    println!("Directorio: {}", work_dir.display());

    let launcher = launcher::Launcher::new(
        work_dir,
        args.port,
        args.no_open,
    );
    launcher.start().await
}
