import process from "process";
import http from "http";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const loopCount = Number(process.env.LOOP_COUNT) || 3;
const NO_NUMBER_VALUE = -1;

/**
 *
 * @param {number[]} randomList
 */
function getRandomNumber(randomList) {
  if (randomList.length === 0) {
    return NO_NUMBER_VALUE;
  }
  const randomIndex = Math.floor(Math.random() * randomList.length);
  return randomList.splice(randomIndex, 1)[0];
}

function generateQuestion(uuid) {
  if (!userMap[uuid]) {
    userMap[uuid] = {
      history: undefined,
      loopCount,
    };
  }
  const target = userMap[uuid];

  if (!target?.firstNumbers) {
    target.firstNumbers = Array.from({ length: 9 })
      .fill(1)
      .map((item, index) => item + index);
  }

  if (!target?.secondNumbers) {
    target.secondNumbers = Array.from({ length: 9 })
      .fill(1)
      .map((item, index) => item + index);
  }

  const { firstNumbers, secondNumbers } = target;
  const operation = `${getRandomNumber(firstNumbers)}+${getRandomNumber(
    secondNumbers
  )}`;

  target.operation = operation;
  target.operationTime = Date.now();
}

function pushHistory(uuid, message) {
  const target = userMap[uuid];

  if (!target) {
    return;
  }

  if (!target?.history) {
    target.history = [];
  }

  target.history.push(message);
}

const userMap = {};

const server = http.createServer((req, res) => {
  const cookieObj = {};

  req.headers.cookie &&
    req.headers.cookie.split(";").forEach((cookie) => {
      let parts = cookie.match(/(.*?)=(.*)$/);
      cookieObj[parts[1].trim()] = (parts[2] || "").trim();
    });

  if (!cookieObj.uuid) {
    const uuid = crypto.randomUUID();
    res.setHeader("Set-Cookie", `uuid=${uuid}; HttpOnly; Path=/`);
  }

  if (req.method === "GET" && req.url === "/api/question") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");

    if (!userMap[cookieObj.uuid]) {
      generateQuestion(cookieObj.uuid);
      res.end(JSON.stringify({ operation: userMap[cookieObj.uuid].operation }));
    } else {
      const target = userMap[cookieObj.uuid];
      res.end(
        JSON.stringify({
          operation: target.operation,
          history: target.history,
        })
      );
    }
  } else if (req.method === "POST" && req.url === "/api/question") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");

      const reqJson = JSON.parse(body);
      const operation = userMap?.[cookieObj.uuid]?.operation;

      const isCorrect =
        cookieObj.uuid && eval(operation) === Number(reqJson.value);
      const message =
        `${operation}=${reqJson.value}: ` +
        (isCorrect ? "Correct answer." : "Wrong answer.") +
        "  " +
        new Intl.DateTimeFormat().format(
          userMap?.[cookieObj.uuid]?.operationTime
        );
      const status = isCorrect ? "ok" : "no";

      if (isCorrect) {
        generateQuestion(cookieObj.uuid);
      }

      pushHistory(cookieObj.uuid, message);

      res.end(
        JSON.stringify({
          status,
          message,
          nextQuestion: userMap[cookieObj.uuid]?.operation,
        })
      );
    });
  } else {
    res.setHeader("Content-Type", "text/html");
    const filePath = path.join(import.meta.dirname, "main.html");
    const readStream = fs.createReadStream(filePath);
    readStream.on("open", () => {
      res.statusCode = 200;
      console.log("miku ok ");
      res.setHeader("Content-Type", "text/html");
      readStream.pipe(res);
    });
    readStream.on("error", (err) => {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain");
      res.end("Server Error");
    });
  }
});

server.listen(3901, () => {
  console.log("Server running at http://localhost:3901/");
});
