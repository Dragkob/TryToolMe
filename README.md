<img width="3518" height="1024" alt="image" src="https://github.com/user-attachments/assets/095b12b9-73f0-48a7-9114-da8da0232d8c" />

---
<p align="center">
  <strong>TryToolMe</strong> - a browser extension for <a href="https://tryhackme.com">TryHackMe</a>: room timelines, public-profile insights, and capability score details.<br>
</p>

---

> [!NOTE]
> I'm currently waiting for THM to approve the release of this tool.

---

### Features

| Area | What it does | Image |
|------|----------------|--------|
| **Room pages** (`/room/…`) | Reads creation & publish dates and shows them in the extension popup in a simple table. | <img width="700" height="700" alt="image" src="https://github.com/user-attachments/assets/8949c752-bce3-4f58-b270-e9479ebe6cca" />|
| **Public profiles** (`/p/…`) | On someone’s (or your own) profile: joined date, league tier, yearly activity totals, and ranked **top active days** for the selected year. | <img width="397" height="586" alt="image" src="https://github.com/user-attachments/assets/b32e4c7f-b366-447d-8d68-dc4257d56a7b" /> |
| **Capability score** | Opens from the popup on TryHackMe:<ul><li>Full score breakdown</li><li>Components</li><li>Trends</li><li>Recent history from TryHackMe’s API (with last-fetch time shown)</li><li>Badge reflects POV/score when you’re on the site</li></ul> | <img width="401" height="600" alt="image" src="https://github.com/user-attachments/assets/240436c6-5aa5-48c8-a1ef-17ccb1a8adc4" /> <hr /> <img width="397" height="592" alt="image" src="https://github.com/user-attachments/assets/4a30806b-8ae4-49db-b95b-0a48874f8b32" />|
| **Caching & settings** | Separate TTLs: room/profile data (days) vs capability score (hours). Clear each cache independently. | <img width="396" height="503" alt="image" src="https://github.com/user-attachments/assets/cb8069f3-5d82-453d-86eb-757e30224692" /> |
| **Privacy** | No separate backend; data stays local except requests you trigger to **tryhackme.com** (and API calls the extension needs for the features above). | <p align="center">/</p> |

> [!NOTE]
> The extension <b>does not</b> change TryHackMe’s pages by injecting unrelated UI; it uses the popup (and content scripts only where needed for room/profile data) to show extra information. The website is <b>not</b> being manipulated in any way, shape or form.

---

### Quick install



1. Download or clone this repository.  
2. Open `chrome://extensions/` (or `edge://extensions/` in Edge).  
3. Turn on **Developer mode**.  
4. Click **Load unpacked** and choose the extension folder (the one that contains `manifest.json`).  
5. Pin the extension if you like; open it while on **tryhackme.com** to use it.
- [INSTALLATION VIDEO GUIDE](https://github.com/Dragkob/TryToolMe/blob/main/INSTALLATION.md)

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

### Support the project

If you find TryToolMe useful:
- Star the repository ⭐
- Share the project with others
- Submit suggestions and improvements

Thank you for contributing to making TryHackMe more transparent!
