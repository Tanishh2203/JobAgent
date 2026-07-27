#!/usr/bin/env bash
# One-shot installer for the systemd timer.
# Run on the target EC2 after cloning the repo and setting up .env + venv.
#
# Prereqs before running this:
#   cd ~/job-agent/scraper
#   python3 -m venv .venv
#   .venv/bin/pip install -r requirements.txt
#   cp .env.example .env && $EDITOR .env   # fill in real values
#
set -euo pipefail

SERVICE_DIR="$(cd "$(dirname "$0")/systemd" && pwd)"

sudo cp "$SERVICE_DIR/job-scraper.service" /etc/systemd/system/
sudo cp "$SERVICE_DIR/job-scraper.timer"   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now job-scraper.timer

echo
echo "Installed. Useful commands:"
echo "  systemctl status  job-scraper.timer"
echo "  systemctl list-timers job-scraper.timer"
echo "  sudo systemctl start job-scraper.service   # run once now"
echo "  journalctl -u job-scraper.service -f       # tail logs"
