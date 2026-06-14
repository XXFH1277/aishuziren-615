import argparse
import json
import os
import sys
import time
import traceback
from pathlib import Path


def utc_now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def read_json(path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    with temp_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    temp_path.replace(path)


class SiyuLocalBridge:
    def __init__(self, runtime_root, bridge_dir):
        self.runtime_root = Path(runtime_root).resolve()
        self.bridge_dir = Path(bridge_dir).resolve()
        self.commands_dir = self.bridge_dir / "commands"
        self.processing_dir = self.bridge_dir / "processing"
        self.completed_dir = self.bridge_dir / "completed"
        self.failed_dir = self.bridge_dir / "failed"
        self.api = None

    def prepare_environment(self):
        os.environ.setdefault("YOLO_CONFIG_DIR", str(self.bridge_dir / "ultralytics"))
        os.environ.setdefault("MPLCONFIGDIR", str(self.bridge_dir / "matplotlib"))
        os.chdir(self.runtime_root)
        runtime_path = str(self.runtime_root)
        if runtime_path not in sys.path:
            sys.path.insert(0, runtime_path)

    def ensure_api(self):
        if self.api is not None:
            return self.api

        self.prepare_environment()
        original_argv = sys.argv[:]
        try:
            sys.argv = [str(self.runtime_root / "start.py")]
            import main  # pylint: disable=import-error,import-outside-toplevel
        finally:
            sys.argv = original_argv

        self.api = main.Api()
        return self.api

    def process_command(self, command_path):
        payload = read_json(command_path)
        command_id = payload.get("id") or command_path.stem
        command_type = payload.get("type")
        processing_path = self.processing_dir / f"{command_id}.json"

        write_json(
            processing_path,
            {
                **payload,
                "status": "processing",
                "processingStartedAt": utc_now(),
                "bridge": {
                    "runtimeRoot": str(self.runtime_root),
                    "mode": "local_main_api",
                },
            },
        )

        if command_type != "speak":
            raise ValueError(f"Unsupported command type: {command_type}")

        text = str(payload.get("text") or "").strip()
        if not text:
            raise ValueError("Speak command text is empty")

        api = self.ensure_api()
        result = api.speak(text)

        completed_payload = {
            **payload,
            "status": "completed",
            "completedAt": utc_now(),
            "bridge": {
                "runtimeRoot": str(self.runtime_root),
                "mode": "local_main_api",
                "method": "main.Api.speak",
            },
            "result": result,
        }
        write_json(self.completed_dir / f"{command_id}.json", completed_payload)
        write_json(self.bridge_dir / "latest-result.json", completed_payload)
        command_path.unlink(missing_ok=True)
        return completed_payload

    def fail_command(self, command_path, error):
        command_id = command_path.stem
        try:
            payload = read_json(command_path)
            command_id = payload.get("id") or command_id
        except Exception:
            payload = {
                "id": command_id,
                "type": "unknown",
            }

        failed_payload = {
            **payload,
            "status": "failed",
            "failedAt": utc_now(),
            "bridge": {
                "runtimeRoot": str(self.runtime_root),
                "mode": "local_main_api",
                "method": "main.Api.speak",
            },
            "error": {
                "message": str(error),
                "traceback": traceback.format_exc(),
            },
        }
        write_json(self.failed_dir / f"{command_id}.json", failed_payload)
        write_json(self.bridge_dir / "latest-result.json", failed_payload)
        command_path.unlink(missing_ok=True)
        return failed_payload

    def process_pending(self):
        self.commands_dir.mkdir(parents=True, exist_ok=True)
        processed = []
        for command_path in sorted(self.commands_dir.glob("*.json")):
            try:
                processed.append(self.process_command(command_path))
            except Exception as error:  # noqa: BLE001 - persisted for local diagnosis
                processed.append(self.fail_command(command_path, error))
        return processed


def parse_args():
    parser = argparse.ArgumentParser(description="Consume siyuAI local bridge commands.")
    parser.add_argument("--runtime-root", required=True)
    parser.add_argument("--bridge-dir", required=True)
    parser.add_argument("--poll-interval", type=float, default=0.5)
    parser.add_argument("--once", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    bridge = SiyuLocalBridge(args.runtime_root, args.bridge_dir)
    print(
        json.dumps(
            {
                "event": "siyu_bridge_started",
                "runtimeRoot": str(bridge.runtime_root),
                "bridgeDir": str(bridge.bridge_dir),
                "pollInterval": args.poll_interval,
                "once": args.once,
                "startedAt": utc_now(),
            },
            ensure_ascii=False,
        ),
        flush=True,
    )

    while True:
        bridge.process_pending()
        if args.once:
            break
        time.sleep(max(args.poll_interval, 0.1))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
