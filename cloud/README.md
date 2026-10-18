# Fade Lineups cloud synchronization / 点位云同步

## Current state / 当前状态

Cloud sync is **prepared but not activated**. Existing GitHub Pages content and local
IndexedDB data remain unchanged. Do not publish the sync scripts before the private
Supabase backend is configured and tested.

云同步代码已准备好，但暂未启用。当前网页中的本地点位、截图与 JSON 备份不受影响。

## Required cloud setup / 必须完成的云端设置

1. Connect a Supabase project to the authorized owner account.
2. In the project SQL Editor, execute `supabase-setup.sql`.
3. In Authentication settings, enable Email login and decide whether new signups
   require email confirmation (recommended).
4. Copy the **Project URL** and **publishable key** (`sb_publishable_...`
   or legacy `anon` JWT) to a published `cloud-config.js`.
   **Never** use a service-role or secret key on the client.
5. Load the Supabase JS v2 browser bundle, then the config, CSS, and sync script
   **after** `practice.js`. For example:

```html
<link rel="stylesheet" href="cloud/cloud-sync.css">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="cloud/cloud-config.js"></script>
<script src="cloud/cloud-sync.js"></script>
```

6. Test on a separate account with a JSON backup before using valuable data.
   Export each existing map's JSON on the original computer before initial pairing.

## Intended behavior / 预期行为

- Private email/password login across phone and desktop.
- First computer: uploads a local map and its teaching screenshots.
- Second device with a fresh map: downloads the corresponding private snapshot.
- Existing local content on both devices: user chooses which version wins.
- Normal saving and practice status changes trigger automatic cloud upload.
- Changes from another device are read on map opening, tab focus, and periodically.
- Conflicts never silently overwrite an unsynced local change.
- Local IndexedDB data always remains available without cloud connectivity.
- JSON export/import is still recommended as an independent backup.

## Important limits / 注意事项

Snapshots are entire maps, including embedded base64 images, with a 48 MiB client
limit. Uploads of large maps may consume bandwidth and storage. Auth settings,
RLS, mobile Safari login, quota, and storage lifecycle must be verified against
the actual Supabase project before the integration is enabled.

同步使用地图整包快照，最大约 48 MiB。首次连接、移动端登录、存储配额及
权限策略需要在真实云项目上测试通过后再启用。
