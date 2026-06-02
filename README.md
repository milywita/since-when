# Since When?

> *"Since when have you been avoiding this?"*

A task manager built entirely on **reverse psychology, guilt, and sarcasm** and it works perfectly because of it.

## The Idea

Most task managers motivate you with streaks, countdowns, and friendly nudges. **Since When** does the opposite.

The moment you add a task, a live counter starts. Not a deadline countdown but an **avoidance counter**. It ticks up relentlessly, tracking exactly how long you have been ignoring something. It becomes a persistent notification you cannot dismiss. It stares at you:

> *"You have been avoiding 'Reply to that email' for 4 days, 13 hours, 7 minutes."*

Every 24 hours it fires a milestone update:

> *"ACHIEVEMENT UNLOCKED: One week of creative avoidance."*

And when you finally *finally* complete the task, confetti explodes and the app delivers its verdict:

> *"You did it. It took 11 days but you did it."*

The task still gets done. The app just makes sure you **feel every single minute** of the delay.

## Why This Theme

This project was built for the **"Task Failed Successfully"** hackathon theme.

A normal task manager succeeds through positive reinforcement. **Since When** technically functions as a perfect task manager, but it succeeds through entirely the wrong mechanism: **guilt, sarcasm, and public shame**. It is a productivity app that weaponises your procrastination against you. Task failed successfully, except the task always gets done in the end.

## Modes

### Solo
The default. Just you, your tasks, and your growing shame. No one else sees anything. Private tasks live here until you decide otherwise.

### Share
Generate a link or QR code and invite a specific person to watch your avoidance in real time. They can see your public tasks and their live counters, and send reactions:

- *"Killing it!"*
- *"I'm watching you respectfully."*
- *"Do it faster."*
- *"Judging."*

Share links have an expiry (24h / 7d / 30d, or until all tasks are done). You choose exactly which tasks to share, no accidental oversharing. Non-app users can view tasks in a lightweight web preview; they need an account to send reactions, which is a natural growth mechanic.

### Together
Two or more users working at the same time in a shared focus session. Think Focusmate but with the **Since When** layer on top. Everyone sees each other's active task and its live counter. Sessions are time-boxed (25 min, 50 min, or custom). When someone completes a task, confetti fires for **everyone** in the session simultaneously.

Rules that keep it sane:
- Max 6 tasks visible to others per person per session.
- Max 3 reactions per task per session.
- One active task per user at a time.
- Unfinished tasks roll back into Solo mode when the session ends and the counter never stops.

## Features

- **Persistent avoidance notifications** always visible, cannot dismiss, always judging.
- **Milestone achievements** sarcastic unlocks for hitting avoidance records.
- **Confetti completion** because you deserve it, even if it took 3 weeks.
- **Friends and reactions** invite people to witness your procrastination.
- **Together sessions** collaborative focus with shared accountability and communal confetti.
- **Task history export** download a printable HTML record of everything you avoided and eventually did, complete with any reactions received. A keepsake.
- **Cross-device sync** login with Firebase so your shame follows you everywhere.

## Running the App

Install dependencies:

```sh
npm install
```

For iOS (first time):

```sh
bundle install
bundle exec pod install
```

Start Metro:

```sh
npm start
```

Run on device/simulator:

```sh
# iOS
npm run ios

# Android
npm run android
```

*Built at a hackathon. Shipped with guilt.*
