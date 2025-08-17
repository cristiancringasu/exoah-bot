#!/bin/bash

SESSION_NAME="otp-server"

# The command we want to run in the screen session
CMD='
npm start
'

# Start the whole thing in a screen session
screen -dmS "$SESSION_NAME" bash -c "$CMD"

echo "Started backend and tunnel in screen session '$SESSION_NAME'"
echo "To attach to the session, run: screen -r $SESSION_NAME"
