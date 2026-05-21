# WP Places Map

Interactive Google Map of locations (clinics, hospitals, branches, offices, points of sale — anything) as a self-contained WordPress plugin.

- Custom post type **Place** + admin meta box (address, GPS, contact, hours).
- **CSV bulk import** with Google Geocoding fallback for rows missing coordinates.
- `[wp_places_map]` shortcode — drop into Divi, Gutenberg, classic editor or theme template.
- Custom-styled markers, **marker clustering**, **type filters**, **info window** with contact details and one-tap "Navigate".
- Public read-only **REST API** at `/wp-json/wp-places-map/v1/facilities`.
- **GitHub auto-update** — WP Admin → Plugins shows update notification, one-click install. No third-party update plugin required.
- Fully localised in Czech.

## Install

1. Download the latest `wp-places-map.zip` from [Releases](https://github.com/ales-pokora/wp-places-map/releases).
2. WP Admin → **Plugins → Add New → Upload Plugin** → choose the ZIP → activate.
3. Settings → **Places Map** → paste a Google Maps API key (Maps JavaScript API + Geocoding API enabled).
4. Add places one-by-one or via **Places Map → CSV Import**.
5. Insert `[wp_places_map]` on any page.

## Shortcode

```
[wp_places_map]
[wp_places_map height="600" zoom="7" filters="yes" cluster="yes"]
[wp_places_map type="nemocnice"]
```

| Attribute | Default | Description |
|---|---|---|
| `height` | `600` | Map height in px. |
| `zoom` | `7` | Initial zoom (overridden if markers fit bounds). |
| `lat`, `lng` | from settings | Initial centre. |
| `type` | – | Render only places with this taxonomy term slug. |
| `filters` | `yes` | Show type filter pills above the map. |
| `cluster` | `yes` | Cluster overlapping markers when zoomed out. |
| `class` | – | Extra CSS class on the wrapper. |

## Release workflow

```bash
# Bump "Version:" in wp-places-map.php and "Stable tag:" in readme.txt, commit.
git tag v1.0.1
git push --tags

# Build a clean ZIP (only tracked files, top-level folder matches plugin slug):
git archive --format=zip --prefix=wp-places-map/ -o wp-places-map.zip HEAD

# Attach to a GitHub release — PUC prefers release assets over auto-generated source tarballs:
gh release create v1.0.1 wp-places-map.zip --generate-notes
```

Sites running the plugin pick up the new version within 12 hours (or instantly via Dashboard → Updates → Check again).

## Auto-update internals

Plugin bundles [`YahnisElsts/plugin-update-checker`](https://github.com/YahnisElsts/plugin-update-checker) v5.6 under `lib/`. On every check it queries the GitHub Releases API for newer tags, prefers ZIP assets whose filename matches `/wp-places-map.*\.zip/i`, and falls back to the source tarball when no asset is attached.

For private repositories or to raise the API rate limit, supply a Personal Access Token (scope `repo`):

- **Via UI:** Settings → Places Map → "GitHub token".
- **Via wp-config.php** (preferred for production):
  ```php
  define( 'WPPM_GITHUB_TOKEN', 'ghp_xxxxxxxxxxxx' );
  ```

## License

GPL-2.0-or-later. Vendored `plugin-update-checker` is MIT (`lib/plugin-update-checker/license.txt`).
