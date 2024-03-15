# Tunarr

Create live TV channels from media on your Plex servers, and more!

Configure your channels, programs, commercials, and settings using the Tunarr web UI.

Access your channels by adding the spoofed Tunarr HDHomerun tuner to Plex, Jellyfin, or Emby. Or utilize the m3u Url with any 3rd party IPTV player app.

<p align="center">
<img src="./design/tunarr-guide.png">
<img src="./design/tunarr-channels.png">
</p>

## Disclaimer

- ⚠️ Tunarr is under **very active** development.
- ⚠️ Expect bugs and breaking changes!
- ⚠️ We are certain there are bugs, given the scale of this rewrite.
- ⚠️ **At this point, we do NOT recommend replacing dizqueTV with Tunarr!**
  - If you would like to try Tunarr, make sure to use a copy of your `.dizquetv` database folder!

## What is this?

Tunarr is a fork / rewrite / rebrand of [**dizqueTV**](https://github.com/vexorian/dizquetv) (which in itself was a fork of other projects!). This project was born out of both a love for TV and an appreciation for the work put into dizqueTV and its predecessors.

Tunarr has the following goals:

- Modernize the stack, both backend and frontend
- Provide an migration path for existing users
- Stabilize the program, fix bugs, and improve performance
- Modernize and "prettify" the Web UI
- And of course, **Add a ton great new features!**

## Features

- "Spoofing" HDHR tuner and a IPTV channel list, providing a large amount of flexibility
- Ease of setup for xteve and Plex playback by mocking a HDHR server.
- Configure your channels once, and play them just the same in any of the other devices.
- Customize your channels and what they play. Make them display their logo while they play. Play filler content (&quot;commercials&quot;, music videos, prerolls, channel branding videos) at specific times to pad time.
- Docker image and prepackage binaries for Windows, Linux and Mac.
- Supports Nvidia for hardware encoding, including in Docker.
- Select media (desired programs and commercials) across multiple Plex servers
- Includes a WEB TV Guide where you can even play channels in your desktop by using your local media player.
- Subtitle support.
- Auto deinterlace any Plex media not marked `"scanType": "progressive"`
- Can be configured to completely force Direct play, if you are ready for the caveats.
- **NEW** Stream your channels directly in the browser using HLS (and soon [MPEG-DASH](https://github.com/chrisbenincasa/tunarr/issues/129))
- **NEW** Dark mode!

## Limitations

- If you want to play the TV channels in Plex using the spoofed HDHR, Plex pass is required.
- Like dizqueTV, Tunarr does not currently watch your Plex server for media updates/changes. You must manually remove and re-add your programs for any changes to take effect. Same goes for Plex server changes (changing IP, port, etc).. You&apos;ll have to update the server settings manually in that case. **NOTE** This feature is actively under development!
- Most players (including Plex) will break after switching episodes if video / audio format is too different. Tunarr can be configured to use ffmpeg transcoding to prevent this, but that costs resources.

## Releases

- https://github.com/chrisbenincasa/Tunarr/releases

## Wiki

- For setup instructions, check [the wiki](https://github.com/chrisbenincasa/Tunarr/wiki)

## Development

[pnpm](https://pnpm.io) and [turbo](https://turbo.build/) are used for package management and development. More details on the development environment, setup, and contributing to come!

### Start dev servers

Run from the root of the project:

```
pnpm turbo dev
```

## License

- The original dizqueTV is released under zlib license (c) 2020 Victor Hugo Soliz Kuncar: we've kept this.
