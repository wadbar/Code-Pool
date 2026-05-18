import { exec } from 'child_process';
exec("ps aux | grep 'git clone' | grep -v grep | awk '{print $2}' | xargs -r kill -9", (err, stdout, stderr) => {
    console.log("Killed stuck git clone processes.");
    exec("ps aux | grep 'worker_ingest' | grep -v grep | awk '{print $2}' | xargs -r kill -9", (err2) => {
        console.log("Killed stuck workers.");
    });
});
