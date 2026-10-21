# DreamPattern launch kit

Drafts for launch week. Nothing here is posted or sent until Rob says go. Post from Rob's own accounts; Reddit and Product Hunt don't allow automated or agency posting.

App Store link (works once 1.0 is released): https://apps.apple.com/app/id6825036931

## Product Hunt

Post on a Tuesday to Thursday, at 12:01 am Pacific (Product Hunt's day starts then). Rob is the maker. Use 3 to 5 of the store screenshots from /mnt/project-files/launch/screenshots/ plus the app icon.

- **Name:** DreamPattern
- **Tagline (60 max):** Speak your dream when you wake, see the patterns over time
- **Topics:** iOS, Health & Fitness, Artificial Intelligence, Journaling
- **Description (260 max):** A private dream journal for iPhone. Tap once when you wake and say what you dreamt. DreamPattern turns it into an entry, gives a thoughtful AI reading of the symbols and feelings, and tracks what keeps coming back. No account, journal stays on your phone.

**Maker's first comment:**

> Hi Product Hunt! I built DreamPattern because I kept forgetting my dreams by the time I'd found a pen. Now I tap once, talk for 30 seconds, and it's saved.
>
> A few choices I made on purpose:
> - No account or sign-up. Your journal lives on your phone and can be locked with Face ID.
> - Readings are reflective, not fortune-telling. They help you think about what a dream might connect to, and never claim to predict anything.
> - The pattern view is the part I use most: after a few weeks you see which people, places and feelings keep showing up.
>
> It's free with 3 AI readings a month; Premium unlocks unlimited readings and full patterns. I'd love feedback, especially on what you'd want from your dream history.

## Reddit

Rules differ per community and change often. Read each subreddit's sidebar before posting, post from Rob's account, and never post the same text to several subs on the same day. Many dream subs ban self-promotion outright; in those, only take part in conversations and mention the app if someone asks.

| Subreddit | Approach |
|---|---|
| r/SideProject | Launch post allowed. Use the "I built" draft below. |
| r/iosapps | App posts allowed. Short version of the draft, with the store link. |
| r/apple (App Saturday thread, if still running) | Follow the thread's required format. |
| r/Dreams, r/LucidDreaming, r/DreamInterpretation | Check rules first. Default: no promo post; join discussions as a dream journaler. |
| r/productivity, r/Journaling | Only if the sub allows tools; frame it around the habit, not the app. |

**"I built" draft (r/SideProject):**

> **I built a dream journal you can talk to when you're half asleep**
>
> I wanted to keep a dream journal for years but always forgot the dream before I'd written anything. So I built DreamPattern for iPhone: tap once, say what you remember, and it's saved. It can also give a reflective AI reading and, over time, shows the symbols and people that keep recurring.
>
> Things I cared about: no account, data stays on the phone, readings that don't pretend to predict the future.
>
> Built with Expo/React Native, SQLite on device, and a small Supabase function that calls Claude for readings. Happy to answer questions about the build or the App Store review process (that was an adventure).
>
> Link: https://apps.apple.com/app/id6825036931

## Press and newsletters

Send only after release, one personal email each, from dreampattern.app@gmail.com, with a short pitch, the store link, 3 screenshots and a promo code for Premium. Types of outlets to target (Claude will build the actual contact list from their public "submit an app" pages before sending):

- iPhone app review and "new apps this week" sites
- Indie and solo-maker newsletters
- Sleep, wellbeing and journaling blogs and newsletters
- Local press (Rob's town) for a "local maker launches app" angle

**Pitch email draft:**

> Subject: New iPhone app: a dream journal you talk to when you wake
>
> Hi {name},
>
> I'm Rob, a solo maker, and I just launched DreamPattern, a private dream journal for iPhone. You tap once, speak your dream before it fades, and it gives a reflective AI reading and tracks recurring symbols over time. No account, and the journal stays on your phone.
>
> If it's a fit for {outlet}, here's a free year of Premium to try it: {code}
> App Store: https://apps.apple.com/app/id6825036931
>
> Happy to answer any questions.
> Rob

## Creators (month 2, if the numbers support it)

Target small creators (5k to 100k followers) who post about dreams, sleep, journaling or spirituality on TikTok and Instagram. Offer a free year of Premium via an App Store offer code, no obligation to post. Paid posts only once we know what a paying user is worth.

**DM draft:**

> Hi {name}! I love your videos on {topic}. I make DreamPattern, a dream journal app where you speak your dream when you wake and see the patterns over time. Would you like a free year of Premium to try it? No strings attached. If you ever feature it, I'd be happy to share your video too.

## Offer codes

App Store Connect → DreamPattern → Subscriptions → Premium Annual → Offer Codes lets Apple generate one-time codes for a free year. Create a batch of 100 after release for press and creators. This is a quick setup in App Store Connect that Claude can do from Rob's signed-in browser.
