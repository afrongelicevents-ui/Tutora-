# Backups

Every night at about 03:23 Harare time, **Actions → Daily backup** copies the whole live
database and keeps it for 30 days. Run it any time by hand: Actions → Daily backup → Run workflow.

- It is free. It reads the database once; no Cloudflare or Neon limits are used beyond that.
- The repository is public, so every copy is **locked**. Only the owner's private key,
  `tutora-backup-private-key.pem`, can open it. Keep that file safe outside GitHub (for example in
  your password manager or a private Google Drive folder). Without it, the backups can't be opened.
- Neon also keeps its own short history, which can undo mistakes from the last few hours.

## Restoring (needs a computer, or ask Claude)

1. Open Actions → Daily backup → the run you want → Artifacts, and download `tutora-backup-YYYY-MM-DD`.
   Unzip it: you get `tutora-YYYY-MM-DD.dump.enc` and `tutora-YYYY-MM-DD.key.enc`.
2. Unlock it, with `tutora-backup-private-key.pem` in the same folder:

   ```sh
   openssl pkeyutl -decrypt -inkey tutora-backup-private-key.pem \
     -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 \
     -in tutora-YYYY-MM-DD.key.enc -out key.bin
   openssl enc -d -aes-256-cbc -pbkdf2 -in tutora-YYYY-MM-DD.dump.enc -out db.dump -pass file:key.bin
   ```

3. Put it into an empty database (a new Neon branch is safest), then point the site at it:

   ```sh
   pg_restore --no-owner --no-privileges --dbname "postgres://…new database address…" db.dump
   ```

4. Delete `key.bin` and `db.dump` afterwards: they hold real families' data.
