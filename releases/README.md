# Releases

Attach `orrery-install.zip` to each [GitHub Release](https://github.com/kenjugmail/webeph/releases) as **`orrery-install.zip`** (exact filename — the download page expects this).

Rebuild from buddyide:

```powershell
cd c:\Users\kenju\Documents\buddyide
powershell -File scripts\package-orrery-install.ps1
copy dist\orrery-install.zip c:\Users\kenju\Documents\webeph\releases\orrery-install.zip
```

The zip contains start scripts and `INSTALL.md`. Users still need a full **buddyide** clone; the bundle is the quick-start layer on top.
