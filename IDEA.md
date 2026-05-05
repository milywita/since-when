Concept
"Since When" is a task timer built on reverse psychology. Instead of counting down a deadline, it counts up from the moment you added a task, displaying exactly how long you have been avoiding it. The name comes directly from the question the app silently asks you: "Since when have you been avoiding this?"


Core Mechanic
You add a task and the app immediately begins a live counter. This is displayed as a persistent notification you cannot dismiss, showing something like: "You have been avoiding 'Reply to that email' for 4 days, 13 hours, 7 minutes."

Every 24 hours, a new notification fires with a milestone update, for example: "ACHIEVEMENT UNLOCKED: One week of creative avoidance." When you finally complete the task, a confetti animation plays with the message: "You did it. It took 11 days but you did it."

Why it fits the "Task Failed Successfully" theme
A normal task manager motivates through positive reinforcement and countdown timers. "Since When" technically works perfectly as a task manager, but it succeeds through entirely the wrong mechanism: guilt, sarcasm, and public shame. The task still gets done. The app just makes sure you feel every minute of the delay.

Social and Sharing Features 
User visibility and reactions
Tasks can be marked public or private on an individual basis, so users have full control over what others see. Friends added through an invite or QR/link system can view your public tasks and send timed reactions such as: "Killing it!", "I'm watching you respectfully", "Do it faster", or "Judging etc

Modes
Three core usage modes were discussed: Solo (just you), Share (invite a specific person via link/QR), and Together(collaborative focus session)

>SOLO
This is the default state. You add tasks, the counter starts, persistent notifications haunt you, and no other user ever sees anything. Private tasks live here permanently unless you manually move them to Share or Together.
No major design problems here. It is the safest mode to build first and the foundation everything else sits on.

NO PROBLEMS HERE


>SHARE MODE
You invite a specific person via a link or QR code. They can see your public tasks and their avoidance counters, and they can send reactions to them ("Judging you respectfully", "Do it faster", etc.)

Problem 1: When does a Share session end?

Solution: Share mode should have an explicit expiry. Options are: the link expires after a set time (24 hours, 7 days, 30 days, user chooses when generating it), or it expires once all shared tasks are completed. The person who created the link can also revoke it manually at any time. When it expires, the other person simply loses visibility, no notification needed.

Problem 2: What exactly does the invited person see?

Solution: When you generate a share link, you choose which tasks to include at that moment. New tasks added after generating the link are private by default unless you explicitly add them to the shared view. This gives the user full control and avoids accidental oversharing.

Problem 3: Can the invited person add their own tasks?

Solution: No

Problem 4: What happens if the invited person does not have the app?

If Share links open in a browser, non-users can see your tasks as a read-only page. But they cannot send reactions without an account.

Solution: The link opens a lightweight web preview showing the tasks and their live counters, no account needed to view. To send a reaction, they need to sign up or log in. This is actually a good growth mechanic because it naturally brings new users in.


>TOGETHER MODE
Two or more users are working at the same time, in a shared focused session. Think Focusmate but with the "Since When" layer on top. Each person adds what they are working on, everyone can see each other's active task and how long it has been alive.

When you complete a task, the confetti animation now fires for everyone in the session, not just you. All participants see it on their screen simultaneously along with the message "They did it. 'Fix the login bug'  gone etc.



eProblem 1: When does a Together session end?

Unlike Share mode, Together is supposed to be time-bounded. But if one person finishes their task early, does the session end for everyone?

Solution: Together sessions have a defined duration set at the start, for example 25 minutes, 50 minutes, or a custom time, similar to a Pomodoro block. When the timer ends, the session closes for everyone regardless of task completion. Any unfinished tasks automatically roll back into Solo mode and continue counting up. This keeps sessions clean and intentional.

Problem 2: What does "visible to others" actually mean?

Solution: Full daily task lists are visible, this needs a clearer answer. When you join a Together session, you choose which tasks from your list to bring into the session. You are not forced to expose everything. Private tasks stay private by default and never appear in Together mode unless you explicitly bring them in. Think of it as packing for a work session: you take what is relevant, not your entire backlog.

Problem 3: How do you mark a task as active?
Solution: There is a single tap action next to each task: "Set as active." Only one task can be active at a time per user. If you tap a different task, it becomes the new active one. The previously active task goes back to the regular list visually, but its avoidance counter never stops. The active highlight is just a signal to others, not a pause on anything

Problem 4: What if someone has too many tasks and the session view gets cluttered?
If someone brings 12 tasks into a session, the view becomes unreadable for everyone else. A sensible limit is needed.

Solution: Cap the number of tasks visible to others in a session at 6 per person. If you have more than 6, you choose which 6 to show. The rest stay in your personal list and are not visible in the session. This keeps the shared view clean without restricting how many tasks you actually manage.

Problem 5: If reactions are live, someone could flood you with 30 notifications in a minute 

Solution:  Each person can send a maximum of 3 reactions per task per session. That is enough to be present, funny, or encouraging without becoming noise. The limit resets if the session is extended or a new one starts.

Problem 6: Can others see the avoidance counter on your tasks?

Solution:  YES!!


Login and data
A login system is needed for cross-device syncing, data safety, and enabling the friends/visibility features. Without it, all data is stored locally and is prone to loss

Task lifespan
Tasks live indefinitely until completed. If a task crosses midnight, it does not disappear. It carries over with a visual tag indicating how many days have passed, for example transitioning from "24h" to "1 day", "2 days", and so on.


Export
A download or printable HTML export of your task history, including any reactions and comments received, was discussed as a feature to preserve memories of completed tasks.

Design Philosophy (meow meow meow)
Simplicity and clarity over feature bloat. The app should feel neat and intentional, not overwhelming. Every feature should serve the core joke and the core function, which are the same thing: making you confront how long you have been avoiding something


TODO:
Task implementation
