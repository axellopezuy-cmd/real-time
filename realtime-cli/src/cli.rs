use clap::Parser;
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(name = "realtime", version, about = "Real Time — Live HTML/CSS preview as you type")]
pub struct CliArgs {
    /// Working directory (default: current directory)
    pub directory: Option<String>,

    /// Panel browser port (default: 3000)
    #[arg(short, long, default_value_t = 3000)]
    pub port: u16,

    /// Don't open browser automatically
    #[arg(long)]
    pub no_open: bool,
}

/// Resuelve el directorio de trabajo a un path absoluto canónico.
pub fn resolve_work_dir(dir: Option<&str>) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let path = match dir {
        Some(d) => PathBuf::from(d),
        None => std::env::current_dir()?,
    };
    let canonical = std::fs::canonicalize(&path).map_err(|e| {
        format!("No se puede acceder al directorio '{}': {}", path.display(), e)
    })?;
    if !canonical.is_dir() {
        return Err(format!("'{}' no es un directorio", canonical.display()).into());
    }
    Ok(canonical)
}
