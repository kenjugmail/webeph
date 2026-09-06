# Orrery website distribution

## Hosting contract

- Vercel serves ephemerent.com and its download page.
- Supabase Storage holds only approved installers, blockmaps, update manifests and public proof assets.
- Website prefix: `https://ephemerent.com/downloads/orrery/`.
- Storage target: `https://wjjthkqwcyahamhjkeux.supabase.co/storage/v1/object/public/orrery-releases/`.
- RC feed: website prefix + `rc/`; its metadata is `latest.yml` and `latest-mac.yml`.
  The RC channel is isolated by its directory. Stable builds must use a separate `stable/` feed.
- GitHub remains source control. No GitHub Actions minutes or GitHub Release publication are required.
  Vercel builds and Supabase storage/egress have their own quotas.

## Immediate unsigned Windows test beta

The chosen initial distribution is an unsigned Windows ZIP for a small tester group, with manual
updates. Build it on Windows using buddyide `app:package:unsigned-beta`. Verify Windows startup,
subscriber access and its leak-audit/checksum receipt before approving the ZIP. Upload only the approved
ZIP, checksums and explicitly unsigned receipt under `test-beta/`. Do not upload automatic-update
manifests for this mode. `RELEASE_AVAILABLE` stays false until the tests and human approval are complete.
Windows may warn or block unsigned programs; do not claim publisher authentication or ask users to
disable system protections. No paid code-signing service is used for this path.

## Future signed distribution

1. Create the `orrery-releases` public-read Storage bucket in the existing Supabase project.
   Do not grant anonymous/authenticated customers upload, update or delete policies. Upload only as
   the release operator. Never put source archives, credentials, private maps or raw traces there.
2. Build Windows installers on Windows and universal macOS installers on macOS from the same reviewed
   private-source revision. Use the buddyide local packaging scripts; signing credentials belong in
   local secure configuration/keychains, not the website or GitHub. No installer is created by this setup.
3. Finish package/signature, subscription/staging, leak, integrity and release evidence checks.
   Never replace a published version's artifact bytes. Keep source and debug assets private.
4. Upload version-named installer/zip/dmg/blockmap and approved proof files under `rc/` first.
   Keep filenames exactly as referenced by the generated update manifests. Do not upload a whole
   build directory or repository. The legacy `releases/orrery-install.zip` is excluded from Vercel.
5. Independently download and verify uploaded file hashes and signatures. Check redirected HTTP Range
   requests for differential updates. Only then upload `latest.yml` and `latest-mac.yml`, with cache
   duration zero so clients cannot retain stale channel metadata. Upload credentials stay server/operator-only.
6. Verify both manifests through the website URLs and a real packaged client. Keep automatic download,
   explicit safe restart, anti-downgrade and signature checks. Old GitHub-feed/portable clients need a
   one-time manual installation of the website-fed build; the old feed cannot change already-installed code.
7. Set DOWNLOAD_URL to the verified Windows installer, release version/checksum/proof-page URL to their
   real values, and RELEASE_AVAILABLE=true only after the release approval. Until then the page shows pending.
8. Deploy webeph through Vercel after reviewing its existing uncommitted work. No deployment or bucket
   upload was performed by this configuration change. Verify the live route before announcing availability.

Supabase/Stripe authorization remains separate from download hosting: downloading an installer does
not grant execution, and unsubscribed users can still receive security updates. Live payment/webhook
verification, signing, platform install/update checks and canary approval remain release requirements.
