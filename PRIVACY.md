# Privacy policy — Design First

Last updated: 5 October 2026

Design First is a plugin that runs on your own computer inside Claude Code. Its author operates no
server and receives no data from you.

## What leaves your computer

- **Photo search words and your Pixabay API key** are sent to `pixabay.com` when the plugin searches
  for stock photos or downloads the ones chosen. Pixabay handles these requests under its own
  [privacy policy](https://pixabay.com/service/privacy/).
- **Requests for public web pages** on your topic, when the plugin looks at how pages of that kind
  usually look, and **requests for web fonts** to Google Fonts from the pages it builds.

Nothing else is sent: no project files, no page content, no usage statistics, no identifiers.

## What is stored, and where

- Your Pixabay API key is stored by Claude Code in your operating system's secure credential storage.
  The plugin never writes it to a file and never prints it.
- Search results, downloaded photos, author credits and the pages the plugin builds are written into
  the `prototypes/` folder of the project you are working in. They stay there until you delete them.

## Personal data

The plugin does not collect, read or store personal data. It is not directed at children.

## Removing your data

Delete the `prototypes/` folder in your project. Clear the key in the plugin's options
(`/plugin` in Claude Code), or uninstall the plugin.

## Contact

<https://github.com/GuruDevvv/design-first/issues>
