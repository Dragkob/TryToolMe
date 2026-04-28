<img width="3518" height="1024" alt="image" src="https://github.com/user-attachments/assets/095b12b9-73f0-48a7-9114-da8da0232d8c" />

---
<p align="center">
  <strong>TryToolMe</strong> - a browser extension for <a href="https://tryhackme.com">TryHackMe</a>: room timelines, public-profile insights, and capability score details.<br>
</p>

---

### Features

| Area | What it does |
|------|----------------|
| **Room pages** (`/room/…`) | Reads creation & publish dates and shows them in the extension popup in a simple table. |
| **Public profiles** (`/p/…`) | On someone’s (or your own) profile: joined date, league tier, yearly activity totals, and ranked **top active days** for the selected year. |
| **Capability score** | Opens from the popup on TryHackMe: full score breakdown, components, trends, and recent history from TryHackMe’s API (with last-fetch time shown). Badge reflects POV/score when you’re on the site. |
| **Caching & settings** | Separate TTLs: room/profile data (days) vs capability score (hours). Clear each cache independently. |
| **Privacy** | No separate backend; data stays local except requests you trigger to **tryhackme.com** (and API calls the extension needs for the features above). |

> [!NOTE]
> The extension <b>does not</b> change TryHackMe’s pages by injecting unrelated UI; it uses the popup (and content scripts only where needed for room/profile data) to show extra information. The website is <b>not</b> being manipulated in any way, shape or form.

---

### Quick install

1. Download or clone this repository.  
2. Open `chrome://extensions/` (or `edge://extensions/` in Edge).  
3. Turn on **Developer mode**.  
4. Click **Load unpacked** and choose the extension folder (the one that contains `manifest.json`).  
5. Pin the extension if you like; open it while on **tryhackme.com** to use it.

---
### Contributions

Contributions are welcome. However, due to the Source‑Available license, contributions must follow strict rules:

| **Allowed** | **Not Allowed** |
|:-----------:|:--------------:|
| Submitting pull requests to improve this official repository | Forking the project to publish your own version |
| Reporting issues. If you discover a vulnerability, please contact me directly on [Discord](https://discord.com/invite/QuPszM8KNM) - do **not** create a public issue. | Modifying the project outside of PRs |
| Suggesting enhancements | Reusing the source code in another project |
| Improving documentation | Selling or commercializing the code. Make sure to read the [full license](https://github.com/Dragkob/TryDateMe/blob/main/LICENSE.md). |

---

If you find TryToolMe useful:
- Star the repository ⭐
- Share the project with others
- Submit suggestions and improvements

Thank you for contributing to making TryHackMe more transparent!
