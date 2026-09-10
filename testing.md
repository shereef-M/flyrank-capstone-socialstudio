33da2cd3-6877-431a-91b5-9cc4af89b331


Now let's do the actual recording. Press Ctrl+Alt+Shift+R to start, and go through these steps in order in your terminal — type each comment line exactly as shown (it won't run anything, just shows on screen as a silent caption), then the real command below it.

1. Type this comment, then run the schedule command (replace with your real campaign id):

# schedule this campaign 15 seconds out
curl -X POST http://localhost:3000/campaigns/33da2cd3-6877-431a-91b5-9cc4af89b331/schedule -H "Content-Type: application/json" -d "{\"scheduledFor\":\"$(date -u -d '+15 seconds' +%Y-%m-%dT%H:%M:%S.000Z)\"}"

2. Type this comment, then run:

# confirm no worker process is running right now
ps aux | grep worker | grep -v grep

(it printing nothing is the point — that's the proof)

3. Type this comment:

# waiting past the scheduled time, with nothing watching

Then just wait quietly for about 20 seconds — this is fine to sit in silence on screen, it reads as deliberate.

4. Type this comment, then check the campaign (replace with your real id):

# scheduled time has passed - is the job lost?
curl http://localhost:3000/campaigns/33da2cd3-6877-431a-91b5-9cc4af89b331

(should still show "scheduled" / "queued" — the point of this whole demo)

5. Type this comment, then start the worker:

# starting the worker for the first time
npm run worker

Let it sit for a few seconds — its own log lines will show it picking up and completing the job. Then press Ctrl+C to stop it.

6. Type this comment, then check the campaign one final time:

# confirming it recovered with no duplicates
curl http://localhost:3000/campaigns/33da2cd3-6877-431a-91b5-9cc4af89b331

(should now show "published")