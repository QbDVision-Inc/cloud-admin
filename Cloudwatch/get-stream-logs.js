const AWS = require("aws-sdk");
const fs = require("fs");
const process = require("process");

// Check for required arguments
if (process.argv.length < 4) {
  console.error("Usage: node script.js <log-group-name> <log-stream-name> [output_file]");
  process.exit(1);
}

// Define log group and stream names
const logGroupName = process.argv[2];
const logStreamName = process.argv[3];

// Define output file (default: log_stream_name.log)
const outputFile = process.argv[4] || `${logStreamName}.log`;

// Instantiate CloudWatchLogs
AWS.config.update({ region: "us-east-1" });
const cwl = new AWS.CloudWatchLogs({ apiVersion: "2014-03-28" });

let allEvents = [];

// Get logs using forward and backward tokens (if available)
let currentForwardToken = null;
let currentBackwardToken = null;
// Previous tokens for comparison
let previousForwardToken = "";
let previousBackwardToken = "";

(async function getLogs() {
  try {
    while (true) {
      let forwardResults = null;
      if (currentForwardToken !== previousForwardToken) {
        console.log("Retrieving forward logs...");
        forwardResults = await cwl.getLogEvents({
          logGroupName,
          logStreamName,
          nextToken: currentForwardToken
        }).promise();
        allEvents.push(...forwardResults.events);
        currentForwardToken = forwardResults.nextForwardToken;
      }

      if (currentForwardToken === previousForwardToken) {
        console.log("Retrieving backward logs...");
        const backwardResults = await cwl.getLogEvents({
          logGroupName,
          logStreamName,
          nextToken: currentBackwardToken
        }).promise();
        allEvents.push(...backwardResults.events);
        currentBackwardToken = backwardResults.nextBackwardToken;
      }

      if (currentForwardToken === previousForwardToken && currentBackwardToken === previousBackwardToken) {
        break;
      }

      previousForwardToken = currentForwardToken;
      previousBackwardToken = currentBackwardToken;
    }

    // Sort logs chronologically for a consistent order
    console.log("Sorting logs chronologically...");
    console.log(`Found ${allEvents.length} log events.`)
    console.log(allEvents[0].timestamp, allEvents[allEvents.length - 1].timestamp);
    const allLogs = allEvents.sort((ev1, ev2) => ev1.timestamp - ev2.timestamp).map(event => event.message);

    // Write all logs to the output file
    console.log(`Writing logs to ${outputFile}...`);
    fs.writeFileSync(outputFile, allLogs.join("\n"));

    // Success message
    console.log(`Logs from ${logStreamName} saved to ${outputFile}`);
  } catch (error) {
    console.error("Error: Failed to get log events.", error);
    process.exit(1);
  }
})();
