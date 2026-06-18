let metroData;
let lines = {};
let riverFocus = 0;
let riverMemory = 0;
let riverClicks = 0;

let selectStartLine, selectStartStation, btnStart;

function preload() {
  metroData = loadJSON("subway.json");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);

  initMapPaths();

  if (metroData && metroData.DATA) {
    metroData.DATA.forEach((item) => {
      let line = item.line_num;
      if (line.startsWith("0")) line = line.substring(1);
      if (lineColors[line]) {
        if (!lines[line]) lines[line] = [];
        lines[line].push(item);
      }
    });

    Object.keys(lines).forEach((lineName) => {
      let stationList = lines[lineName];
      let pathPts = mapPaths[lineName];
      if (pathPts && pathPts.length > 0 && stationList.length > 0) {
        for (let i = 0; i < stationList.length; i++) {
          let ratio = i / Math.max(1, stationList.length - 1);
          if (lineName === "2호선") ratio = i / stationList.length;

          let ptIdx = floor(ratio * (pathPts.length - 1));
          let nextIdx = min(ptIdx + 1, pathPts.length - 1);
          let amt = ratio * (pathPts.length - 1) - ptIdx;

          stationList[i].x = lerp(pathPts[ptIdx].x, pathPts[nextIdx].x, amt);
          stationList[i].y = lerp(pathPts[ptIdx].y, pathPts[nextIdx].y, amt);
        }
      }
    });
  }

  try {
    let savedData = localStorage.getItem("subwayTraces");
    if (savedData) {
      pastJourneys = JSON.parse(savedData);
    }
  } catch (e) {
    pastJourneys = [];
  }

  createStartUI();
}

function createStartUI() {
  selectStartLine = createSelect();
  selectStartLine.position(width / 2 - 120, height / 2 - 20);
  selectStartLine.option("호선 선택");

  Object.keys(lines).forEach((l) => selectStartLine.option(l));
  selectStartLine.changed(updateStationOptions);

  selectStartStation = createSelect();
  selectStartStation.position(width / 2 + 20, height / 2 - 20);
  selectStartStation.option("역 선택");

  btnStart = createButton("궤도 진입");
  btnStart.position(width / 2 - 40, height / 2 + 30);
  btnStart.mousePressed(startJourney);
}

function resetToFirstScreen() {
  state = 0;
  isFirstRide = true;
  hasSeenLine1 = false;
  hasSeenLine9 = false;
  hasSeenHanRiver = false;
  myLines = [];
  transferLinks = [];
  currentLine = "";
  stationName = "";
  currentTransferLines = [];
  visitedStations = [];
  socialScore = 0;
  ep1Immersion = 0;
  ep4Bubble = 0;
  ep8SubPhase = 0;
  phase3Timer = 0;

  mapOffsetX = 120;
  mapOffsetY = 120;
  mapScale = 0.3;

  createStartUI();
}

let state = 0;
let isFirstRide = true;
let hasSeenLine1 = false;
let hasSeenLine9 = false;
let hasSeenHanRiver = false;

let myLines = [];
let transferLinks = [];
let currentLine = "";
let stationName = "";
let currentTransferLines = [];

let visitedStations = [];
let pastJourneys = [];

let particles = [];
let episodeTimer = 0;
let doorAnimTimer = 0;
let phase3Timer = 0;
let currentEpisode = -1;

let mapScale = 0.3;
let mapOffsetX = 120;
let mapOffsetY = 120;

let isDraggingMe = false;
let ep5SeatOccupied = false;
let ep5EmptySeatPos;
let ep5Winner = null;
let ep8ExitersClear = false;
let ep8SubPhase = 0;

let flowMultiplier = 1.0;
let socialScore = 0;
let ep1Immersion = 0;
let ep4Bubble = 0;

const lineColors = {
  "1호선": "#0052A4",
  "2호선": "#00A84D",
  "3호선": "#EF7C1C",
  "4호선": "#00A5DE",
  "5호선": "#996CAC",
  "6호선": "#CD7C2F",
  "7호선": "#747F00",
  "8호선": "#E6186C",
  "9호선": "#BDB092",
};

const hanRiverStations = [
  "용산",
  "노량진",
  "당산",
  "합정",
  "강변",
  "잠실나루",
  "옥수",
  "압구정",
  "이촌",
  "동작",
  "자양(뚝섬유원지)",
  "뚝섬유원지",
  "청담",
];

let episodeTexts = {
  1: "외부와 철저히 단절된 채 복잡한 현실을 벗어납니다.\n오롯이 스마트폰이라는 자신만의 4인치 우주 속으로 깊이 빠져듭니다.\n그것은 군중 속에서 누리는 완벽한 고립의 시간입니다.",
  2: "만원 열차 안에서 이리저리 치이는 거친 흔들림이 이어집니다.\n사람들은 각자의 좁은 공간을 사수하기 위해 애를 씁니다.\n무심한 표정으로 꿋꿋하게 서로를 밀어내는 일상입니다.",
  3: "우연히 타인과 시선이 마주칠 뻔한 아슬아슬한 찰나의 순간입니다.\n반사적으로 고개를 돌려 상대방을 시야에서 완전히 지워버립니다.\n어색함을 지우기 위한 조용한 회피를 보여줍니다.",
  4: "열차가 급정거하며 모두의 몸이 한쪽으로 크게 쏠립니다.\n위태로운 상황에서도 타인에게 기대지 않으려 발끝에 힘을 줍니다.\n서로의 거리를 유지하며 미세한 균형을 필사적으로 잡습니다.",
  5: "비어있는 단 하나의 자리를 두고 차가운 시선이 교차합니다.\n피곤한 몸을 뉘이기 위해 사람들은 조용히 눈치를 봅니다.\n이내 자리를 차지하기 위한 소리 없는 치열한 쟁탈전이 펼쳐집니다.",
  6: "손끝의 터치 한 번으로 노이즈캔슬링이 조용히 켜집니다.\n주변의 모든 피곤한 소음들을 귓가에서 깨끗이 지워냅니다.\n이내 세상과 분리된 완벽한 무음의 세계로 홀로 도피합니다.",
  7: "조용하던 인파 속에서 난동을 부리는 불청객이 갑작스레 등장합니다.\n그 어떤 불필요한 엮임도 피하기 위해 사람들은 신경을 곤두세웁니다.\n모두가 약속이나 한 듯 조용하고 재빠르게 거리를 두고 물러섭니다.",
  8: "열차의 문이 열리고 닫히는 짧은 순간 승하차하는 걸음들이 교차합니다.\n그 수많은 걸음들 사이에는 서로 부딪히지 않는 규칙이 있습니다.\n마치 물이 흐르듯 교차하는 견고하고 암묵적인 질서가 존재합니다.",
  9: "창밖으로 하루를 마감하는 붉은 노을빛이 쏟아져 들어옵니다.\n그 아름다운 풍경을 열차 안의 모두가 다 함께 바라봅니다.\n그 순간만큼은 사람들 사이의 차가운 단절의 경계가 부드럽게 허물어집니다.",
  10: "가만히 멈춰선 빽빽한 인파 속에서 누군가 조심스레 지나갑니다.\n지나갈 수 있도록 몸을 살짝 비켜주는 작은 배려가 일어납니다.\n그 짧은 순간 우리는 미약하지만 따뜻하고 조용한 유대감을 만들어냅니다.",
  11: "타인의 시선과 부딪힘으로부터 가장 멀어질 수 있는 끝자리입니다.\n이곳은 지하철 안에서 누릴 수 있는 가장 안락한 공간입니다.\n누구에게도 방해받지 않는 자신만의 소중한 심리적 영토입니다.",
  12: "사람들 사이를 비집고 지나갈 때 사과 없는 가벼운 부딪힘이 발생합니다.\n그것은 결코 타인을 무시하는 무례함이 아닙니다.\n오히려 멈춰 있는 사람들의 흐름을 깨지 않으려는 무언의 배려입니다.",
  13: "익숙한 듯 낯선 카트 소리와 누군가의 큰 외침이 고요를 깹니다.\n사람들은 약속이라도 한 듯 일제히 눈을 감거나 스마트폰으로 고개를 숙입니다.\n절대 시선을 마주치지 않겠다는 굳은 의지로 만들어낸 연대이자 방어선입니다.",
  14: "숨 막히는 밀집도와 매서운 속도감이 온몸을 짓누릅니다.\n이곳은 누구나 피하고 싶지만 견뎌내야만 하는 극한의 출퇴근길입니다.\n쏟아지는 거대한 압력 속에 휩쓸리지 않도록 필사적으로 버텨야 합니다.",
  15: "창밖으로 넓게 펼쳐진 한강이 모습을 드러냅니다.\n바쁘게 지나가던 생각들이 잠시 멈춰섭니다.\n아무것도 하지 않은 채 그 풍경을 천천히 바라봅니다.",
};

let mapPaths = {};

function saveCurrentJourney() {
  if (visitedStations.length > 0) {
    pastJourneys.push([...visitedStations]);
    if (pastJourneys.length > 100) pastJourneys.shift();
    localStorage.setItem("subwayTraces", JSON.stringify(pastJourneys));
  }
}

function updateStationOptions() {
  let selectedLine = selectStartLine.value();
  selectStartStation.html("");
  if (lines[selectedLine]) {
    lines[selectedLine].forEach((station) => {
      selectStartStation.option(station.station_nm);
    });
  }
}

function initMapPaths() {
  mapPaths["2호선"] = [];
  for (let a = 0; a <= TWO_PI; a += TWO_PI / 40)
    mapPaths["2호선"].push(createVector(cos(a) * 200, sin(a) * 150));
  mapPaths["1호선"] = [
    createVector(250, -250),
    createVector(100, -100),
    createVector(-50, -20),
    createVector(-150, 100),
    createVector(-300, 250),
  ];
  mapPaths["3호선"] = [
    createVector(-200, -250),
    createVector(-80, -100),
    createVector(20, 20),
    createVector(120, 150),
    createVector(250, 250),
  ];
  mapPaths["4호선"] = [
    createVector(150, -300),
    createVector(50, -100),
    createVector(-20, 0),
    createVector(-50, 150),
    createVector(-150, 300),
  ];
  mapPaths["5호선"] = [
    createVector(-350, 50),
    createVector(-150, -20),
    createVector(0, -40),
    createVector(150, -20),
    createVector(350, 50),
  ];
  mapPaths["6호선"] = [
    createVector(-250, -80),
    createVector(-100, -120),
    createVector(100, -120),
    createVector(250, -50),
  ];
  mapPaths["7호선"] = [
    createVector(200, -350),
    createVector(150, -150),
    createVector(50, 50),
    createVector(-100, 200),
    createVector(-250, 350),
  ];
  mapPaths["8호선"] = [
    createVector(200, 100),
    createVector(250, 150),
    createVector(200, 250),
    createVector(150, 300),
  ];
  mapPaths["9호선"] = [
    createVector(-350, 120),
    createVector(-150, 100),
    createVector(100, 100),
    createVector(350, 150),
  ];
}

function getStationObject(lineName, stName) {
  if (lines[lineName])
    return lines[lineName].find((s) => s.station_nm === stName);
  return null;
}

function isAtEndSeat(px, py) {
  let seatX1 = width / 2 - 195;
  let seatX2 = width / 2 + 195;
  let seatY1 = height / 2 - 100;
  let seatY2 = height / 2 + 100;
  return (
    dist(px, py, seatX1, seatY1) < 40 ||
    dist(px, py, seatX2, seatY1) < 40 ||
    dist(px, py, seatX1, seatY2) < 40 ||
    dist(px, py, seatX2, seatY2) < 40
  );
}

function startJourney() {
  currentLine = selectStartLine.value();
  stationName = selectStartStation.value();
  if (currentLine === "호선 선택" || stationName === "역 선택") {
    alert("호선과 역을 모두 선택해주세요.");
    return;
  }
  myLines.push(currentLine);
  let stObj = getStationObject(currentLine, stationName);
  if (stObj)
    visitedStations.push({
      line: currentLine,
      name: stationName,
      x: stObj.x,
      y: stObj.y,
    });
  selectStartLine.remove();
  selectStartStation.remove();
  btnStart.remove();
  checkBoarding();
}

function checkBoarding() {
  if (isFirstRide) {
    state = 0.5;
    doorAnimTimer = 0;
    isDraggingMe = false;
    initParticles();
  } else {
    triggerEpisode();
  }
}

function triggerEpisode() {
  state = 1;
  episodeTimer = 0;
  riverClicks = 0;
  riverMemory = 0;
  riverFocus = 0;
  isDraggingMe = false;
  isFirstRide = false;
  flowMultiplier = 1.0;
  ep8SubPhase = 0;

  let isHanRiver = hanRiverStations.includes(stationName);

  // 한강 구간 처음 진입 시에만 15번 에피소드 호출
  if (isHanRiver && !hasSeenHanRiver) {
    currentEpisode = 15;
    hasSeenHanRiver = true;
  } else if (currentLine === "1호선" && !hasSeenLine1) {
    currentEpisode = 13;
    hasSeenLine1 = true;
  } else if (currentLine === "9호선" && !hasSeenLine9) {
    currentEpisode = 14;
    hasSeenLine9 = true;
  } else {
    let generalEps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    currentEpisode = random(generalEps);
  }

  initParticles();
}

function advanceStation() {
  if (lines[currentLine]) {
    let currentLineStations = lines[currentLine];
    let idx = currentLineStations.findIndex(
      (s) => s.station_nm === stationName,
    );
    let nextStationObj;
    if (idx >= 0 && idx < currentLineStations.length - 1)
      nextStationObj = currentLineStations[idx + 1];
    else if (idx === currentLineStations.length - 1)
      nextStationObj = currentLineStations[0];
    if (nextStationObj) {
      stationName = nextStationObj.station_nm;
      visitedStations.push({
        line: currentLine,
        name: stationName,
        x: nextStationObj.x,
        y: nextStationObj.y,
      });
    }
  }
}

function checkTransfers() {
  currentTransferLines = [];
  for (let l in lines) {
    if (l !== currentLine && lineColors[l]) {
      if (lines[l].some((s) => s.station_nm === stationName))
        currentTransferLines.push(l);
    }
  }
  if (currentTransferLines.length === 0) {
    alert(`${stationName}역은 다른 호선으로 환승할 수 없습니다.`);
    return false;
  }
  return true;
}

function drawSmoothJourney(journey, isMain, isMiniMap, score, alphaVal = 255) {
  if (journey.length < 2) return;
  let curLine = journey[1].line;
  let segment = [journey[0]];

  let drawSeg = (pts, lineStr) => {
    let c = color(lineColors[lineStr] || "#999");
    if (isMain) {
      strokeWeight(isMiniMap ? 8 : 6);
      if (!isMiniMap) {
        drawingContext.shadowBlur = 15;
        drawingContext.shadowColor = color(red(c), green(c), blue(c), alphaVal);
      }
      if (!isMiniMap && score > 5) stroke(255, 215, 0, alphaVal);
      else stroke(red(c), green(c), blue(c), isMiniMap ? 200 : alphaVal);
    } else {
      strokeWeight(isMiniMap ? 2 : 3);
      if (!isMiniMap) drawingContext.shadowBlur = 0;
      stroke(red(c), green(c), blue(c), isMiniMap ? 15 : alphaVal * 0.2);
    }
    beginShape();
    for (let pt of pts) vertex(pt.x, pt.y);
    endShape();
  };

  for (let i = 1; i < journey.length; i++) {
    if (journey[i].line === curLine) segment.push(journey[i]);
    else {
      drawSeg(segment, curLine);
      curLine = journey[i].line;
      segment = [journey[i - 1], journey[i]];
    }
  }
  drawSeg(segment, curLine);
}

// =====================================
// 배경 렌더링 함수들
// =====================================
function drawSubwayBackground() {
  push();
  noStroke();
  fill(235, 235, 240);
  rect(0, 0, width, height * 0.45);
  fill(210, 215, 220);
  rect(0, height * 0.45, width, height * 0.55);

  stroke(190, 195, 200);
  strokeWeight(2);
  let cx = width / 2;
  for (let x = -width; x < width * 2; x += 100)
    line(x, height, cx + (x - cx) * 0.3, height * 0.45);

  stroke(150, 160, 170);
  strokeWeight(4);
  line(0, height * 0.45, width, height * 0.45);

  if (currentEpisode !== 9 && currentEpisode !== 15 && currentEpisode !== 14) {
    rectMode(CENTER);
    let windowW = width / 4;
    let windowH = height * 0.28;
    for (let i = -1; i <= 1; i++) {
      let x = width / 2 + i * (windowW + 40);
      let y = height * 0.22;
      fill(200, 210, 220, 80);
      stroke(150, 160, 170);
      strokeWeight(3);
      rect(x, y, windowW, windowH, 10);
    }
  }

  stroke(190);
  strokeWeight(12);
  line(0, 80, width, 80);

  for (let x = width / 4; x < width; x += width / 4) {
    stroke(200);
    strokeWeight(16);
    line(x, 0, x, height * 0.45);
    fill(150);
    noStroke();
    rectMode(CENTER);
    rect(x, 80, 40, 24, 6);
    fill(170);
    ellipse(x, height * 0.45, 40, 16);
  }

  for (let x = 60; x < width; x += 90) {
    if (
      abs(x - width / 4) < 40 ||
      abs(x - width / 2) < 40 ||
      abs(x - width * 0.75) < 40
    )
      continue;
    stroke(170);
    strokeWeight(5);
    line(x, 80, x, 125);
    noFill();
    stroke(80, 150, 200);
    strokeWeight(6);
    circle(x, 140, 30);
  }
  pop();
}

function drawCorridorBackground() {
  push();
  fill(180, 185, 190);
  rect(0, 0, width, height);

  stroke(150, 155, 160);
  strokeWeight(4);
  let laneWidth = 100;
  for (let x = width / 2 - 200; x <= width / 2 + 200; x += laneWidth) {
    line(x, 0, x, height);
  }

  let speed = 5;
  let offset = (frameCount * speed) % 100;
  stroke(160, 165, 170);
  strokeWeight(2);
  for (let y = -100; y < height + 100; y += 100) {
    line(width / 2 - 200, y + offset, width / 2 + 200, y + offset);
  }

  fill(140);
  noStroke();
  rect(0, 0, width / 2 - 200, height);
  rect(width / 2 + 200, 0, width, height);
  pop();
}

function draw() {
  background(245);
  if (state === 0) drawPhase0();
  else if (state === 0.5) drawPhase0_5();
  else if (state === 1) drawPhase1();
  else if (state === 2 || state === 2.5) drawPhase2();
  else if (state === 3) drawPhase3();
  if (state > 0 && state < 3) drawMiniMap();
}

function drawPhase0() {
  fill(30);
  textSize(32);
  textFont("Georgia");
  text("무음의 궤적", width / 2, height / 2 - 100);
  fill(100);
  textSize(16);
  textFont("sans-serif");
  text("출발역과 탑승 호선을 입력하세요.", width / 2, height / 2 - 60);
}

function drawPhase0_5() {
  doorAnimTimer++;
  drawSubwayBackground();
  for (let p of particles) {
    p.pos.y = lerp(p.pos.y, p.targetPos.y, 0.05);
    p.display(0, 0);
  }
  let doorWidth = width / 2;
  let openOffset = constrain(
    map(doorAnimTimer, 20, 100, 0, doorWidth),
    0,
    doorWidth,
  );
  fill(50);
  noStroke();
  rect(0, 0, doorWidth - openOffset, height);
  rect(width / 2 + openOffset, 0, doorWidth - openOffset, height);
  fill(50, map(doorAnimTimer, 0, 60, 255, 0));
  textSize(36);
  textFont("Georgia");
  text("열차 탑승", width / 2, height / 2);
  if (doorAnimTimer > 120) triggerEpisode();
}

function drawPhase1() {
  episodeTimer++;

  if (currentEpisode === 8) {
    if (episodeTimer === 250) {
      ep8SubPhase = 1;
      let exiters = particles.filter((p) => p.ep8Role === "exit" || p.isMe);
      particles.forEach((p) => {
        if (p.ep8Role !== "exit" && !p.isMe) p.isExited = true;
      });
      for (let i = 0; i < exiters.length; i++) {
        exiters[i].laneX =
          width / 2 + (i % 3 === 0 ? -80 : i % 3 === 1 ? 0 : 80);
        exiters[i].pos.set(exiters[i].laneX, height + i * 40);
        exiters[i].isExited = false;
        exiters[i].vel.mult(0);
      }
    }
  }

  push();
  if (currentEpisode === 2 || currentEpisode === 14) {
    let shakeForce = currentEpisode === 14 ? 5 : 2;
    translate(
      sin(frameCount * 0.8) * shakeForce,
      cos(frameCount * 0.6) * (shakeForce / 2),
    );
  }

  if (currentEpisode === 8) {
    if (ep8SubPhase === 0) drawSubwayBackground();
    else if (ep8SubPhase === 1) drawCorridorBackground();
  } else {
    drawSubwayBackground();
  }

  // Ep 7: 불청객 대피소 UI 렌더링
  if (currentEpisode === 7) {
    push();
    let safeZones = [
      createVector(100, 150),
      createVector(width - 100, 150),
      createVector(100, height - 200),
      createVector(width - 100, height - 200),
    ];
    let safeR = 80;

    fill(50, 200, 100, 30);
    stroke(50, 200, 100, 150);
    strokeWeight(2);
    drawingContext.setLineDash([5, 5]);
    for (let sz of safeZones) {
      circle(sz.x, sz.y, safeR * 2);
    }
    drawingContext.setLineDash([]);
    noStroke();
    fill(50, 150, 80);
    textSize(14);
    textFont("sans-serif");
    for (let sz of safeZones) {
      text("안전 구역", sz.x, sz.y);
    }
    pop();

    let me = particles[0];
    me.isSafe = false;
    for (let sz of safeZones) {
      if (dist(me.pos.x, me.pos.y, sz.x, sz.y) < safeR) {
        me.isSafe = true;
        break;
      }
    }
  }

  // Ep 10: 길 비켜줄 때 연결망 및 배려 시각화
  if (currentEpisode === 10) {
    let me = particles[0];
    for (let i = 1; i < particles.length; i++) {
      let other = particles[i];
      if (other.isYielding) {
        let d = dist(me.pos.x, me.pos.y, other.pos.x, other.pos.y);
        push();
        strokeWeight(4);
        drawingContext.shadowBlur = 10;
        drawingContext.shadowColor = color(255, 200, 100);
        stroke(255, 220, 150, map(d, 50, 180, 255, 0));
        line(me.pos.x, me.pos.y, other.pos.x, other.pos.y);
        pop();
      }
    }
  }

  // Ep 1: 스마트폰 몰입 시 어두워지는 배경
  if (currentEpisode === 1) {
    if (particles[0].contentState === 1) {
      ep1Immersion = lerp(ep1Immersion, 1, 0.05);
    } else {
      ep1Immersion = lerp(ep1Immersion, 0, 0.05);
    }

    if (ep1Immersion > 0.01) {
      push();
      noStroke();
      fill(10, 10, 30, ep1Immersion * 220);
      rect(0, 0, width, height);
      pop();
    }
  }

  // Ep 6: 노이즈 캔슬링 어두운 배경
  if (currentEpisode === 6 && particles[0].hasShield) {
    push();
    fill(5, 10, 20, 210);
    rect(0, 0, width, height);
    let me = particles[0];
    drawingContext.save();
    drawingContext.globalCompositeOperation = "destination-out";
    let gradient = drawingContext.createRadialGradient(
      me.pos.x,
      me.pos.y,
      0,
      me.pos.x,
      me.pos.y,
      me.r * 6,
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    drawingContext.fillStyle = gradient;
    circle(me.pos.x, me.pos.y, me.r * 12);
    drawingContext.restore();
    pop();
  }

  if (currentEpisode === 9) {
    drawEp9Windows();
    push();
    stroke(190);
    strokeWeight(12);
    line(0, 80, width, 80);
    for (let x = width / 4; x < width; x += width / 4) {
      stroke(200);
      strokeWeight(16);
      line(x, 0, x, height * 0.45);
      fill(150);
      noStroke();
      rectMode(CENTER);
      rect(x, 80, 40, 24, 6);
      fill(170);
      ellipse(x, height * 0.45, 40, 16);
    }
    for (let x = 60; x < width; x += 90) {
      if (
        abs(x - width / 4) < 40 ||
        abs(x - width / 2) < 40 ||
        abs(x - width * 0.75) < 40
      )
        continue;
      stroke(170);
      strokeWeight(5);
      line(x, 80, x, 125);
      noFill();
      stroke(80, 150, 200);
      strokeWeight(6);
      circle(x, 140, 30);
    }
    pop();
  }

  if (currentEpisode === 14) {
    drawEp14FastWindows();
    push();
    stroke(190);
    strokeWeight(12);
    line(0, 80, width, 80);
    for (let x = width / 4; x < width; x += width / 4) {
      stroke(200);
      strokeWeight(16);
      line(x, 0, x, height * 0.45);
      fill(150);
      noStroke();
      rectMode(CENTER);
      rect(x, 80, 40, 24, 6);
      fill(170);
      ellipse(x, height * 0.45, 40, 16);
    }
    for (let x = 60; x < width; x += 90) {
      if (
        abs(x - width / 4) < 40 ||
        abs(x - width / 2) < 40 ||
        abs(x - width * 0.75) < 40
      )
        continue;
      stroke(170);
      strokeWeight(5);
      line(x, 80, x, 125);
      noFill();
      stroke(80, 150, 200);
      strokeWeight(6);
      circle(x, 140, 30);
    }
    pop();
  }

  if (currentEpisode === 15) {
    drawEp15RiverWindows();
    push();
    let windowW = width / 4;
    let windowH = height * 0.28;

    for (let i = -1; i <= 1; i++) {
      let wx = width / 2 + i * (windowW + 40);

      let wy = height * 0.22;
    }

    stroke(190);
    strokeWeight(12);
    line(0, 80, width, 80);
    for (let x = width / 4; x < width; x += width / 4) {
      stroke(200);
      strokeWeight(16);
      line(x, 0, x, height * 0.45);
      fill(150);
      noStroke();
      rectMode(CENTER);
      rect(x, 80, 40, 24, 6);
      fill(170);
      ellipse(x, height * 0.45, 40, 16);
    }
    for (let x = 60; x < width; x += 90) {
      if (
        abs(x - width / 4) < 40 ||
        abs(x - width / 2) < 40 ||
        abs(x - width * 0.75) < 40
      )
        continue;
      stroke(170);
      strokeWeight(5);
      line(x, 80, x, 125);
      noFill();
      stroke(80, 150, 200);
      strokeWeight(6);
      circle(x, 140, 30);
    }
    pop();
  }

  if (currentEpisode === 8 && ep8SubPhase === 0) {
    push();
    stroke(180);
    strokeWeight(6);
    line(0, height - 165, width / 2 - 85, height - 165);
    line(width / 2 + 85, height - 165, width, height - 165);
    pop();
    ep8ExitersClear = true;
    for (let p of particles) {
      if (p.ep8Role === "exit" && !p.isExited) {
        ep8ExitersClear = false;
        break;
      }
    }
  }

  if (currentEpisode === 5 || currentEpisode === 11) drawSubwaySeats();

  if (isDraggingMe) {
    particles[0].pos.set(mouseX, mouseY);
    particles[0].hasBeenDragged = true;
  }
  for (let p of particles) {
    p.update(currentEpisode, episodeTimer);
    p.display(currentEpisode, episodeTimer);
  }

  pop(); // --- 마스터 화면 흔들림(Translate) 제어 끝 ---

  // 텍스트 및 UI 영역은 흔들림의 영향을 받지 않도록 최하단에 렌더링
  push();
  fill(40);
  textSize(20);
  textLeading(30);
  textFont("Georgia");
  let epText = episodeTexts[currentEpisode];
  if (currentEpisode === 8 && ep8SubPhase === 1) {
    epText =
      "끝없는 환승 통로 속에서 일정한 간격으로 앞사람을 따라 걷습니다.\n수많은 사람들의 행렬은 조용하고 묵묵하게 무언의 질서를 유지합니다.\n이 피곤한 동행 속에서도 서로를 방해하지 않으려는 노력이 보입니다.";
  }
  text(epText, width / 2, height - 120);

  fill(120);
  textSize(14);
  textFont("sans-serif");
  textAlign(CENTER, CENTER);
  text(getGuideText(currentEpisode), width / 2, height - 60);

  fill(150);
  textSize(12);
  text(
    "우측 하단의 NEXT 버튼을 누르면 다음 화면으로 넘어갑니다.",
    width / 2,
    height - 40,
  );

  let nextBtnX = width - 70;
  let nextBtnY = height - 50;
  let nextBtnW = 100;
  let nextBtnH = 40;
  let isNextHover =
    abs(mouseX - nextBtnX) < nextBtnW / 2 &&
    abs(mouseY - nextBtnY) < nextBtnH / 2;

  rectMode(CENTER);
  fill(isNextHover ? 220 : 255);
  stroke(150);
  strokeWeight(2);
  rect(nextBtnX, nextBtnY, nextBtnW, nextBtnH, 20);

  fill(30);
  noStroke();
  textSize(16);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  text("NEXT", nextBtnX, nextBtnY);
  textStyle(NORMAL);
  pop();
}

function getGuideText(ep) {
  if (ep === 1)
    return "나를 터치해 외부와 단절된 완벽한 무음의 세계로 빠져들어 보세요.";
  if (ep === 2)
    return "마우스를 누른 채로 움직여 비좁은 공간 속에서 주변 타인들을 밀어내 보세요.";
  if (ep === 3)
    return "중앙의 원을 드래그하여 다른 사람 근처로 다가가 시야에서 조용히 지워보세요.";
  if (ep === 4)
    return "화면 중앙을 강하게 클릭하여 급정거 속에서 자신의 개인 공간을 강하게 확보하세요.";
  if (ep === 5)
    return "비어있는 자리를 향해 드래그하여 다른 사람들보다 먼저 자리를 차지하세요!";
  if (ep === 6)
    return "자신을 클릭하여 주변의 소음을 완벽히 차단하는 노이즈캔슬링 보호막을 켜보세요.";
  if (ep === 7)
    return "가만히 있으면 위험합니다. 마우스로 모서리의 안전 구역으로 드래그해 대피하세요.";
  if (ep === 8)
    return "어떤 조작 없이도 규칙적으로 엇갈리며 움직이는 사람들의 거대한 흐름을 가만히 관찰해 보세요.";
  if (ep === 9)
    return "화면 중앙을 터치하여 다 함께 창밖의 따스하고 붉은 노을빛으로 물들어 보세요.";
  if (ep === 10)
    return "드래그하여 멈춰선 인파들 사이의 좁은 틈을 조심스럽고 유연하게 지나가 보세요.";
  if (ep === 11)
    return "드래그하여 비어있는 양 끝자리 중 한 곳에 앉아 안락하고 안전한 영역을 확보하세요.";
  if (ep === 12)
    return "원하는 방향으로 드래그하여 가벼운 부딪힘을 감수하며 사람들 사이를 빠르게 빠져나가 보세요.";
  if (ep === 13)
    return "요란한 소음이 다가옵니다. 나를 클릭해 다른 승객들처럼 회색이 되어 완벽한 무관심으로 대처하세요.";
  if (ep === 14)
    return "강한 압력이 당신을 밀어냅니다. 마우스로 자신을 드래그하여 휩쓸리지 않게 중앙으로 버텨내세요.";
  if (ep === 15)
    return "창문을 클릭해 보세요. 클릭할수록 흐릿한 한강 풍경의 디테일이 조금씩 드러납니다.";
  return "";
}

function drawEp9Windows() {
  push();
  rectMode(CENTER);
  noStroke();
  let windowW = width / 4;
  let windowH = height * 0.28;
  for (let i = -1; i <= 1; i++) {
    let x = width / 2 + i * (windowW + 40);
    let y = height * 0.22;
    let c1 = color(255, 150, 80);
    let c2 = color(80, 40, 100);
    for (let j = -windowH / 2; j < windowH / 2; j += 5) {
      let inter = map(j, -windowH / 2, windowH / 2, 0, 1);
      fill(lerpColor(c1, c2, inter));
      rect(x, y + j + 2.5, windowW, 5);
    }
  }
  stroke(150, 160, 170);
  strokeWeight(3);
  noFill();
  for (let i = -1; i <= 1; i++)
    rect(width / 2 + i * (windowW + 40), height * 0.22, windowW, windowH, 10);
  pop();
}

function drawEp14FastWindows() {
  push();
  rectMode(CENTER);
  noStroke();
  let windowW = width / 4;
  let windowH = height * 0.28;
  for (let i = -1; i <= 1; i++) {
    let x = width / 2 + i * (windowW + 40);
    let y = height * 0.22;
    fill(20, 20, 30);
    rect(x, y, windowW, windowH);

    let speed = 40;
    let lineOffset = (frameCount * speed) % windowW;
    stroke(255, 100);
    strokeWeight(4);
    for (let ly = y - windowH / 2 + 20; ly < y + windowH / 2; ly += 30) {
      let lx = x - windowW / 2 + lineOffset;
      if (lx > x + windowW / 2) lx -= windowW;
      line(lx, ly, lx + 50, ly);
    }
  }
  stroke(150, 160, 170);
  strokeWeight(3);
  noFill();
  for (let i = -1; i <= 1; i++)
    rect(width / 2 + i * (windowW + 40), height * 0.22, windowW, windowH, 10);
  pop();
}

function drawEp15RiverWindows() {
  push();
  rectMode(CENTER);
  noStroke();
  let windowW = width / 4;
  let windowH = height * 0.28;
  for (let i = -1; i <= 1; i++) {
    let x = width / 2 + i * (windowW + 40);
    let y = height * 0.22;

    let skyC1 = color(135, 206, 235);
    let skyC2 = color(200, 230, 255);
    for (let j = -windowH / 2; j < 0; j += 5) {
      let inter = map(j, -windowH / 2, 0, 0, 1);
      fill(lerpColor(skyC1, skyC2, inter));
      rect(x, y + j + 2.5, windowW, 5);
    }
    if (riverMemory > 0.2) {
      fill(255, (riverMemory - 0.2) * 300);

      ellipse(x - 80, y - 30, 60, 30);

      ellipse(x - 40, y - 35, 40, 20);

      ellipse(x + 70, y - 20, 70, 35);
    }

    let riverC1 = color(100, 180, 255);
    let riverC2 = color(10, 60, 120);
    for (let j = 0; j < windowH / 2; j += 5) {
      let inter = map(j, 0, windowH / 2, 0, 1);
      fill(lerpColor(riverC1, riverC2, inter));
      rect(x, y + j + 2.5, windowW, 5);
    }

    fill(255, riverMemory * 255);
    for (let s = 0; s < riverMemory * 50; s++) {
      let sx = x - windowW / 2 + ((s * 43 + frameCount) % windowW);
      let sy = y + map(noise(s * 10, frameCount * 0.01), 0, 1, 0, windowH / 2);
      ellipse(sx, sy, map(noise(s * 5, frameCount * 0.05), 0, 1, 2, 8), 2);
    }
  }
  stroke(150, 160, 170);
  strokeWeight(3);
  noFill();
  for (let i = -1; i <= 1; i++)
    rect(width / 2 + i * (windowW + 40), height * 0.22, windowW, windowH, 10);
  pop();
}

function drawSubwaySeats() {
  push();
  rectMode(CENTER);
  stroke(180);
  strokeWeight(2);
  fill(230);
  let seatW = 60,
    seatH = 65;
  for (let i = 0; i < 7; i++)
    rect(width / 2 - 195 + i * 65, height / 2 - 100, seatW, seatH, 5);
  for (let i = 0; i < 7; i++)
    rect(width / 2 - 195 + i * 65, height / 2 + 100, seatW, seatH, 5);
  pop();
}

function drawPhase2() {
  fill(255, 200);
  rect(0, 0, width, height);
  for (let p of particles) {
    p.vel.mult(0.8);
    p.update(-1, 0);
    p.display(-1, 0);
  }
  fill(30);
  textSize(24);
  textFont("Georgia");
  text(
    `[${currentLine}] ${stationName}역에 도착했습니다.`,
    width / 2,
    height / 2 - 60,
  );
  textFont("sans-serif");

  if (state === 2) {
    drawCanvasButton(width / 2 - 140, height / 2 + 20, "계속 간다", 120);
    drawCanvasButton(width / 2, height / 2 + 20, "환승한다", 120);
    drawCanvasButton(width / 2 + 140, height / 2 + 20, "내린다", 120);
  } else if (state === 2.5) {
    textSize(16);
    fill(80);
    text("환승할 호선을 선택하세요:", width / 2, height / 2 - 20);
    let xOffset = -(currentTransferLines.length * 40) / 2 + 20;
    let yOffset = height / 2 + 30;
    for (let i = 0; i < currentTransferLines.length; i++) {
      drawColorButton(
        width / 2 + xOffset,
        yOffset,
        currentTransferLines[i],
        lineColors[currentTransferLines[i]],
      );
      xOffset += 40;
    }
  }
}

function drawCanvasButton(x, y, label, w = 120, alphaVal = 255) {
  push();
  rectMode(CENTER);
  let isHover = abs(mouseX - x) < w / 2 && abs(mouseY - y) < 22.5;
  fill(isHover ? 200 : 255, alphaVal);
  stroke(150, alphaVal);
  rect(x, y, w, 45, 8);
  fill(30, alphaVal);
  noStroke();
  textSize(16);
  text(label, x, y);
  pop();
}

function drawColorButton(x, y, label, col) {
  push();
  rectMode(CENTER);
  let isHover = dist(mouseX, mouseY, x, y) < 18;
  fill(col);
  stroke(150);
  strokeWeight(isHover ? 3 : 1);
  rect(x, y, 30, 30, 5);
  fill(255);
  noStroke();
  textSize(14);
  textFont("sans-serif");
  text(label.replace("호선", ""), x, y);
  pop();
}

function mousePressed() {
  if (state === 1) {
    let nextBtnX = width - 70;
    let nextBtnY = height - 50;
    let nextBtnW = 100;
    let nextBtnH = 40;

    if (
      abs(mouseX - nextBtnX) < nextBtnW / 2 &&
      abs(mouseY - nextBtnY) < nextBtnH / 2
    ) {
      state = 2;
      return;
    }

    let dMe = dist(mouseX, mouseY, particles[0].pos.x, particles[0].pos.y);

    if (currentEpisode === 4 && dMe < particles[0].r + 15) {
      particles[0].personalSpace = min(particles[0].personalSpace + 40, 150);
      for (let p of particles) {
        if (!p.isMe) {
          let d = dist(
            particles[0].pos.x,
            particles[0].pos.y,
            p.pos.x,
            p.pos.y,
          );
          if (d < 300) {
            let pushDir = p5.Vector.sub(p.pos, particles[0].pos)
              .normalize()
              .mult(40);
            p.vel.add(pushDir);
          }
        }
      }
    }

    if (currentEpisode === 1) {
      let meP = particles[0];
      let phoneY = meP.pos.y + meP.r + 25;
      if (
        dist(mouseX, mouseY, meP.pos.x, phoneY) < 30 ||
        dist(mouseX, mouseY, meP.pos.x, meP.pos.y) < 30
      ) {
        meP.contentState = meP.contentState === 1 ? 0 : 1;
      }
    } else if ([3, 4, 5, 7, 10, 11, 12, 14].includes(currentEpisode)) {
      if (dMe < particles[0].r + 15) {
        isDraggingMe = true;
      }
    } else if (currentEpisode === 6) {
      if (dMe < particles[0].r * 1.5) {
        particles[0].hasShield = !particles[0].hasShield;
      }
    } else if (currentEpisode === 13) {
      if (dMe < particles[0].r * 1.5) {
        particles[0].isIndifferent = !particles[0].isIndifferent;

        for (let i = 1; i < particles.length; i++) {
          if (!particles[i].isPreacher) {
            particles[i].isIndifferent = particles[0].isIndifferent;
          }
        }
      }
    } else if (currentEpisode === 9) {
      if (dMe < particles[0].r * 1.5) {
        particles[0].isSunsetTinted = !particles[0].isSunsetTinted;
      }
    } else if (currentEpisode === 15) {
      let windowW = width / 4;
      let windowH = height * 0.28;

      for (let i = -1; i <= 1; i++) {
        let wx = width / 2 + i * (windowW + 40);
        let wy = height * 0.22;

        if (
          mouseX > wx - windowW / 2 &&
          mouseX < wx + windowW / 2 &&
          mouseY > wy - windowH / 2 &&
          mouseY < wy + windowH / 2
        ) {
          riverClicks++;

          riverMemory = constrain(riverClicks * 0.15, 0, 1);

          break;
        }
      }
    }
  } else if (state === 2) {
    if (
      abs(mouseX - (width / 2 - 140)) < 60 &&
      abs(mouseY - (height / 2 + 20)) < 22.5
    ) {
      advanceStation();
      checkBoarding();
    } else if (
      abs(mouseX - width / 2) < 60 &&
      abs(mouseY - (height / 2 + 20)) < 22.5
    ) {
      if (checkTransfers()) {
        state = 2.5;
      }
    } else if (
      abs(mouseX - (width / 2 + 140)) < 60 &&
      abs(mouseY - (height / 2 + 20)) < 22.5
    ) {
      saveCurrentJourney();
      state = 3;
    }
  } else if (state === 2.5) {
    let xOffset = -(currentTransferLines.length * 40) / 2 + 20;
    for (let i = 0; i < currentTransferLines.length; i++) {
      if (dist(mouseX, mouseY, width / 2 + xOffset, height / 2 + 30) < 18) {
        let prevLine = currentLine;
        currentLine = currentTransferLines[i];
        myLines.push(currentLine);
        let targetStationObj = getStationObject(currentLine, stationName);
        if (targetStationObj) {
          visitedStations.push({
            line: currentLine,
            name: stationName,
            x: targetStationObj.x,
            y: targetStationObj.y,
          });
          if (prevLine !== currentLine) {
            let prevStationObj = getStationObject(prevLine, stationName);
            if (prevStationObj)
              transferLinks.push({ p1: prevStationObj, p2: targetStationObj });
          }
        }
        checkBoarding();
        break;
      }
      xOffset += 40;
    }
  } else if (state === 3) {
    if (phase3Timer > 450) {
      if (
        mouseX > width - 150 &&
        mouseX < width &&
        abs(mouseY - (height - 50)) < 30
      ) {
        resetToFirstScreen();
      }
    }
  }
}

function mouseReleased() {
  isDraggingMe = false;
  if (currentEpisode === 11) {
    let me = particles[0];
    let seats = [
      createVector(width / 2 - 195, height / 2 - 100),
      createVector(width / 2 + 195, height / 2 - 100),
      createVector(width / 2 - 195, height / 2 + 100),
      createVector(width / 2 + 195, height / 2 + 100),
    ];
    let nearest = seats[0];
    let minD = dist(me.pos.x, me.pos.y, nearest.x, nearest.y);
    for (let s of seats) {
      let d = dist(me.pos.x, me.pos.y, s.x, s.y);
      if (d < minD) {
        minD = d;
        nearest = s;
      }
    }
    if (minD < 100) {
      me.pos.lerp(nearest, 0.4);
      me.vel.mult(0);
    }
  }
}

function drawPhase3() {
  phase3Timer++;

  if (phase3Timer < 150) {
    fill(255, 200);
    rect(0, 0, width, height);
    for (let p of particles) {
      p.display(-1, 0);
    }
    fill(30);
    textSize(24);
    textFont("Georgia");
    text(
      `[${currentLine}] ${stationName}역에 도착했습니다.`,
      width / 2,
      height / 2 - 60,
    );

    let fadeAlpha = map(phase3Timer, 0, 100, 0, 255);
    fadeAlpha = constrain(fadeAlpha, 0, 255);
    fill(10, 15, 20, fadeAlpha);
    rect(0, 0, width, height);

    if (phase3Timer > 40 && phase3Timer < 150) {
      let textAlpha = map(phase3Timer, 40, 80, 0, 255);
      if (phase3Timer > 120) textAlpha = map(phase3Timer, 120, 150, 255, 0);
      fill(255, textAlpha);
      textSize(20);
      textFont("sans-serif");
      text("열차에서 내립니다...", width / 2, height / 2 + 30);
    }
    return;
  }

  background(10, 15, 20);

  mapOffsetX = lerp(mapOffsetX, width / 2, 0.05);
  mapOffsetY = lerp(mapOffsetY, height / 2, 0.05);
  mapScale = lerp(mapScale, 0.8, 0.05);

  push();
  translate(mapOffsetX, mapOffsetY);
  scale(mapScale);
  noFill();
  strokeJoin(ROUND);
  strokeCap(ROUND);

  let traceAlpha = map(phase3Timer, 150, 250, 0, 255);
  traceAlpha = constrain(traceAlpha, 0, 255);

  strokeWeight(3);
  for (let journey of pastJourneys) {
    drawSmoothJourney(journey, false, false, 0, traceAlpha);
  }

  strokeWeight(6);
  drawingContext.shadowBlur = 15;
  for (let i = 0; i < visitedStations.length - 1; i++) {
    let myCol = color(lineColors[visitedStations[i + 1].line]);
    drawingContext.shadowColor = color(
      red(myCol),
      green(myCol),
      blue(myCol),
      traceAlpha,
    );
    stroke(red(myCol), green(myCol), blue(myCol), traceAlpha);
    line(
      visitedStations[i].x,
      visitedStations[i].y,
      visitedStations[i + 1].x,
      visitedStations[i + 1].y,
    );
  }
  drawingContext.shadowBlur = 0;

  for (let link of transferLinks) {
    stroke(255, traceAlpha);
    strokeWeight(4);
    drawingContext.shadowBlur = 10;
    drawingContext.shadowColor = color(255, traceAlpha);
    line(link.p1.x, link.p1.y, link.p2.x, link.p2.y);
    fill(255, traceAlpha);
    noStroke();
    circle(link.p1.x, link.p1.y, 8);
    circle(link.p2.x, link.p2.y, 8);
  }
  drawingContext.shadowBlur = 0;
  for (let vSt of visitedStations) {
    let c = color(lineColors[vSt.line]);
    fill(red(c), green(c), blue(c), traceAlpha);
    noStroke();
    circle(vSt.x, vSt.y, 6);
  }
  pop();

  if (phase3Timer > 300) {
    let textAlpha = map(phase3Timer, 300, 400, 0, 255);
    textAlpha = constrain(textAlpha, 0, 255);

    fill(255, textAlpha);
    textSize(18);
    textLeading(30);
    textStyle(NORMAL);
    textFont("sans-serif");

    let msg =
      "때로는 서로를 향한 조용한 무관심이\n가장 편안한 배려가 되는 공간.\n\n" +
      "우리는 시선을 거두고 각자의 거리를 유지하며\n서로를 위해 보이지 않는 선을 지켜주었습니다.\n\n" +
      "수많은 궤적이 겹쳐지는 이 화면처럼\n우리는 닿지 않은 채로도 일상을 지탱하는 거대한 연결망의 일부입니다.\n\n" +
      "서로를 향한 작고 무심한 배려들이 모여\n결국 우리는 이 도시를 같이 살아갑니다.";

    text(msg, width / 2, height / 2 - 30);
  }

  if (phase3Timer > 450) {
    let btnAlpha = map(phase3Timer, 450, 500, 0, 255);
    btnAlpha = constrain(btnAlpha, 0, 255);

    push();
    fill(120, btnAlpha);
    textSize(14);
    textFont("sans-serif");
    textAlign(RIGHT, CENTER);
    text("처음으로 돌아가기", width - 40, height - 50);
    pop();
  }
}

function drawMiniMap() {
  push();
  fill(250, 230);
  noStroke();
  rectMode(CORNER);
  rect(10, 10, 220, 220, 12);
  translate(120, 120);
  scale(0.25);
  noFill();
  strokeJoin(ROUND);
  strokeCap(ROUND);
  strokeWeight(2);
  for (let journey of pastJourneys) drawSmoothJourney(journey, false, true, 0);
  strokeWeight(8);
  drawSmoothJourney(visitedStations, true, true, socialScore);

  for (let link of transferLinks) {
    stroke(100);
    strokeWeight(6);
    line(link.p1.x, link.p1.y, link.p2.x, link.p2.y);
  }
  if (visitedStations.length > 0) {
    let latest = visitedStations[visitedStations.length - 1];
    fill(lineColors[latest.line]);
    stroke(255);
    strokeWeight(3);
    circle(latest.x, latest.y, 16);
  }
  pop();
}

function initParticles() {
  ep1Immersion = 0;
  ep4Bubble = 0;
  particles = [];
  ep5SeatOccupied = false;
  ep5Winner = null;
  ep8ExitersClear = false;
  particles.push(new Particle(width / 2, height / 2, true));
  particles[0].isSunsetTinted = false;

  if (currentEpisode === 11) {
    particles[0].targetPos.set(width / 2, height / 2 + 200);
    particles[0].pos.set(particles[0].targetPos.copy());
    for (let row = 0; row < 2; row++) {
      let y = height / 2 - 100 + row * 200;
      for (let i = 0; i < 7; i++) {
        let isEndSeat = i === 0 || i === 6;
        if (isEndSeat) continue;
        if (random() < 0.25) {
          let x = width / 2 - 195 + i * 65;
          let p = new Particle(x, y, false);
          p.pos.set(x, y);
          p.isStatic = true;
          particles.push(p);
        }
      }
    }
  } else if (currentEpisode === 10) {
    particles[0].targetPos.set(width / 2, height / 2 + 150);
    particles[0].pos.set(particles[0].targetPos.copy());
    for (let i = 1; i < 65; i++) {
      let placed = false,
        attempts = 0;
      while (!placed && attempts < 3000) {
        let rx = random(100, width - 100),
          ry = random(120, height - 220),
          tooClose = false;
        for (let p of particles) {
          if (dist(rx, ry, p.targetPos.x, p.targetPos.y) < 75) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          let p = new Particle(rx, ry, false);
          p.pos.set(rx, ry);
          p.isStatic = true;
          particles.push(p);
          placed = true;
        }
        attempts++;
      }
    }
    let challenger = particles[1],
      minDist = Infinity;
    for (let i = 1; i < particles.length; i++) {
      let d = dist(
        particles[i].pos.x,
        particles[i].pos.y,
        width / 2,
        height / 2,
      );
      if (d < minDist) {
        minDist = d;
        challenger = particles[i];
      }
    }
    challenger.isStatic = false;
    challenger.isEp10Challenger = true;
  } else if (currentEpisode === 5) {
    particles[0].targetPos.set(width / 2, height / 2 + 200);
    particles[0].pos.set(particles[0].targetPos.copy());
    let seats = [];
    for (let i = 0; i < 7; i++)
      seats.push(createVector(width / 2 - 195 + i * 65, height / 2 - 100));
    for (let i = 0; i < 7; i++)
      seats.push(createVector(width / 2 - 195 + i * 65, height / 2 + 100));
    let emptyIdx = floor(random(14));
    ep5EmptySeatPos = seats[emptyIdx].copy();
    for (let i = 0; i < 14; i++) {
      if (i === emptyIdx) continue;
      let p = new Particle(seats[i].x, seats[i].y, false);
      p.pos.set(p.targetPos.copy());
      p.isEp5Sitter = true;
      particles.push(p);
    }
    let challenger = new Particle(
      width / 2 + random(-100, 100),
      height / 2 + 200,
      false,
    );
    challenger.targetPos.set(challenger.pos.copy());
    challenger.isEp5WinnerChallenger = true;
    particles.push(challenger);
    ep5Winner = challenger;
  } else if (currentEpisode === 7) {
    particles[0].targetPos.set(width / 2 - 100, height / 2);
    particles[0].pos.set(particles[0].targetPos.copy());
    let villain = new Particle(width / 2 + 50, height / 2, false);
    villain.pos.set(villain.targetPos.copy());
    villain.isVillain = true;
    villain.vel = p5.Vector.random2D().mult(15);
    particles.push(villain);
    for (let i = 0; i < 30; i++) {
      let p = new Particle(
        width / 2 + random(-100, 100),
        height / 2 + random(-100, 100),
        false,
      );
      p.pos.set(p.targetPos.copy());
      particles.push(p);
    }
  } else if (currentEpisode === 8) {
    particles[0].ep8Role = "exit";
    particles[0].pos.set(width / 2, height / 2 - 100);
    particles[0].targetPos.set(width / 2, height / 2 - 100);
    particles[0].laneX = width / 2;
    let exiters = [];
    let enterers = [];
    for (let i = 1; i < 70; i++) {
      let p = new Particle(0, 0, false);
      let roll = random();
      if (roll < 0.15) {
        p.ep8Role = "stay";
        p.targetPos.set(
          random() > 0.5
            ? random(80, width / 2 - 140)
            : random(width / 2 + 140, width - 80),
          random(100, height - 220),
        );
        p.pos.set(p.targetPos.copy());
      } else if (roll < 0.6) {
        p.ep8Role = "exit";
        exiters.push(p);
      } else {
        p.ep8Role = "enter";
        enterers.push(p);
      }
      particles.push(p);
    }
    exiters.sort((a, b) => b.pos.y - a.pos.y);
    for (let i = 0; i < exiters.length; i++) {
      let lane = i % 2 === 0 ? -40 : 40;
      exiters[i].laneX = width / 2 + lane;
      exiters[i].pos.set(
        exiters[i].laneX + random(-10, 10),
        height / 2 - 100 - floor(i / 2) * 50,
      );
      exiters[i].targetPos.set(exiters[i].laneX, height + 100);
    }
    for (let i = 0; i < enterers.length; i++) {
      let lane = i % 2 === 0 ? -120 : 120;
      enterers[i].laneX = width / 2 + lane;
      enterers[i].pos.set(enterers[i].laneX, height + 40 + floor(i / 2) * 50);
      enterers[i].targetPos.set(
        width / 2 + random(-60, 60),
        height / 2 - random(50, 200),
      );
    }
  } else if (currentEpisode === 13) {
    // 나
    particles[0].pos.set(width / 2, height / 2 + 120);
    particles[0].targetPos.set(width / 2, height / 2 + 120);

    let preacher = new Particle(width / 2, -80, false);
    preacher.isPreacher = true;
    preacher.pos.set(width / 2, -80);
    preacher.targetPos.set(width / 2, 120);
    particles.push(preacher);

    for (let i = 0; i < 50; i++) {
      let rx = random(80, width - 80);
      let ry = random(180, height - 220);

      let p = new Particle(rx, ry, false);

      p.pos.set(rx, ry);
      p.targetPos.set(rx, ry);

      p.isIndifferent = false;

      particles.push(p);
    }
  } else if (currentEpisode === 14) {
    for (let i = 1; i < 250; i++) {
      let rx = random(60, width - 60);
      let ry = random(100, height - 150);
      particles.push(new Particle(rx, ry, false));
    }
  } else {
    let pCount = currentEpisode === 12 ? 60 : currentEpisode === 2 ? 150 : 40;
    for (let i = 1; i < pCount; i++) {
      let placed = false,
        attempts = 0;
      while (!placed && attempts < 100) {
        let rx = random(100, width - 100),
          ry = random(120, height - 220),
          tooClose = false;
        for (let p of particles) {
          let safeDist = currentEpisode === 2 ? 40 : 75;
          if (dist(rx, ry, p.targetPos.x, p.targetPos.y) < safeDist) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          particles.push(new Particle(rx, ry, false));
          placed = true;
        }
        attempts++;
      }
      if (!placed && currentEpisode === 2) {
        particles.push(
          new Particle(
            random(100, width - 100),
            random(120, height - 220),
            false,
          ),
        );
      }
    }
  }
}

class Particle {
  constructor(x, y, isMe) {
    this.targetPos = createVector(x, y);
    this.pos = createVector(x, height + random(200, 500));
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.isMe = isMe;
    this.group = random() > 0.5 ? 1 : -1;
    this.r = 30;
    this.noiseOffset = random(1000);
    this.hasShield = !isMe;
    this.contentState = isMe ? 0 : 1;
    this.ep8Role = "stay";
    this.isStatic = false;
    this.isEp10Challenger = false;
    this.isEp5Sitter = false;
    this.isEp5WinnerChallenger = false;
    this.isVillain = false;
    this.isSunsetTinted = false;
    this.isExited = false;
    this.hasBeenDragged = false;
    this.alpha = 180;
    this.personalSpace = 0;
    this.laneX = 0;
    this.isSafe = false;
    this.isYielding = false;
    this.isPreacher = false;
    this.isHoldingShield = false;
    this.isStressed = false;
    this.isIndifferent = false;
    this.ep5Seated = false;
  }

  applyCollision() {
    if (this.isExited) return;
    if (currentEpisode === 5 && (this.isEp5Sitter || this.ep5Seated)) return;
    if (currentEpisode === 7 && this.isVillain) return;

    for (let other of particles) {
      if (other === this || other.isExited) continue;

      let minDist = this.r * 2 + 10;
      if (currentEpisode === 4 && (this.isMe || other.isMe))
        minDist += particles[0].personalSpace;

      if (currentEpisode === 8 && ep8SubPhase > 0) {
        if (abs(this.laneX - other.laneX) < 10) {
          let dY = abs(this.pos.y - other.pos.y);
          let safeDist = this.r * 2 + 5;
          if (dY < safeDist) {
            let push = (safeDist - dY) * 0.1;
            if (this.pos.y > other.pos.y) this.pos.y += push;
            else this.pos.y -= push;
          }
        }
        continue;
      }

      if (currentEpisode === 8 && ep8SubPhase === 0) {
        if (
          (this.ep8Role === "exit" && other.ep8Role === "enter") ||
          (this.ep8Role === "enter" && other.ep8Role === "exit")
        )
          continue;
      }

      let d = p5.Vector.dist(this.pos, other.pos);
      if (d < minDist && d > 0) {
        if (
          currentEpisode === 4 &&
          (this.isMe || other.isMe) &&
          frameCount % 10 === 0
        )
          socialScore -= 0.05;
        if (currentEpisode === 12 && (this.isMe || other.isMe)) {
          if (isDraggingMe) {
            let flowDir = p5.Vector.sub(other.pos, this.pos)
              .normalize()
              .mult(10);
            other.vel.add(flowDir);
            socialScore += 0.15;
          } else {
            other.vel.mult(0.9);
            socialScore -= 0.08;
          }
        }

        let overlap = minDist - d;
        let dir = p5.Vector.sub(this.pos, other.pos).normalize();

        if (currentEpisode === 8 && ep8SubPhase === 0) {
          if (this.ep8Role === "exit" && other.ep8Role === "exit") {
            dir.x *= 0.05;
            dir.normalize();
          } else if (this.ep8Role === "enter" && other.ep8Role === "enter") {
            dir.x *= 0.2;
            dir.normalize();
          }
        }
        this.pos.add(p5.Vector.mult(dir, overlap * 0.5));
      }
    }
  }

  update(ep, time) {
    if (this.isExited) return;
    if (ep === 15) {
      this.pos.set(this.targetPos);

      this.vel.mult(0);

      return;
    }
    if (ep === 13) {
      let preacher = null;

      for (let p of particles) {
        if (p.isPreacher) {
          preacher = p;
          break;
        }
      }

      if (this.isPreacher) {
        this.pos.y += 2.5;

        return;
      }

      if (preacher) {
        let d = dist(this.pos.x, this.pos.y, preacher.pos.x, preacher.pos.y);

        if (d < 170) {
          let flee = p5.Vector.sub(this.pos, preacher.pos);

          flee.normalize();

          flee.mult(2);

          this.vel.add(flee);

          this.isIndifferent = true;
        } else {
          let back = p5.Vector.sub(this.targetPos, this.pos);

          back.mult(0.03);

          this.vel.add(back);
        }
      }
    }

    this.acc.mult(0);
    let center = createVector(width / 2, height / 2);

    if (ep === 13) {
      if (this.isPreacher) {
        this.pos.y += 1.2;
        this.pos.x += random(-2, 2);
        if (this.pos.y > height + 50) this.pos.y = -50;
        return;
      }
      if (this.isMe) {
        let preacher = particles.find((p) => p.isPreacher);
        if (
          preacher &&
          dist(this.pos.x, this.pos.y, preacher.pos.x, preacher.pos.y) < 250
        ) {
          if (!this.isIndifferent) {
            this.pos.x += random(-4, 4);
            this.pos.y += random(-4, 4);
            this.isStressed = true;
          } else {
            this.isStressed = false;
          }
        } else {
          this.isStressed = false;
        }
      } else {
        let preacher = particles.find((p) => p.isPreacher);
        if (
          preacher &&
          dist(this.pos.x, this.pos.y, preacher.pos.x, preacher.pos.y) < 180
        ) {
          let pushDir = this.pos.x < preacher.pos.x ? -2 : 2;
          this.pos.x += pushDir;
        }
        this.alpha = 50;
      }
      this.applyCollision();
      return;
    }

    if (ep === 14) {
      this.acc.x += random(-1, 1);
      this.acc.y += random(-1, 1);
      if (this.isMe) {
        if (isDraggingMe) {
          this.pos.set(mouseX, mouseY);
        } else {
          let outward = p5.Vector.sub(this.pos, center).normalize().mult(0.4);
          this.acc.add(outward);
        }
      } else {
        let outward = p5.Vector.sub(this.pos, center).normalize().mult(0.1);
        this.acc.add(outward);
      }
      this.vel.add(this.acc);
      this.vel.limit(this.isMe ? 5 : 2);
      this.pos.add(this.vel);
      this.applyCollision();

      if (this.pos.x < 50) this.pos.x = 50;
      if (this.pos.x > width - 50) this.pos.x = width - 50;
      if (this.pos.y < 50) this.pos.y = 50;
      if (this.pos.y > height - 150) this.pos.y = height - 150;
      return;
    }

    if (ep === 3 && !this.isMe) {
      let dMe = dist(
        this.pos.x,
        this.pos.y,
        particles[0].pos.x,
        particles[0].pos.y,
      );
      if (dMe < 150) this.alpha = lerp(this.alpha, 0, 0.3);
      else this.alpha = lerp(this.alpha, 180, 0.05);
    } else if (!this.isMe) {
      this.alpha = 180;
    }

    if (ep === 7) {
      if (this.isMe) {
        if (isDraggingMe) this.hasBeenDragged = true;
        if (!this.hasBeenDragged) {
          this.vel.mult(0);
          this.acc.mult(0);
          return;
        }
        this.applyCollision();
        return;
      }
      let villain = particles.find((p) => p.isVillain);
      if (time > 80) {
        if (this.isVillain) {
          if (frameCount % 20 === 0) {
            this.vel.rotate(random(-PI / 3, PI / 3));
          }
          this.vel.normalize().mult(18);
          this.pos.add(this.vel);

          if (this.pos.x < 30) {
            this.pos.x = 30;
            this.vel.x *= -1;
          }
          if (this.pos.x > width - 30) {
            this.pos.x = width - 30;
            this.vel.x *= -1;
          }
          if (this.pos.y < 30) {
            this.pos.y = 30;
            this.vel.y *= -1;
          }
          if (this.pos.y > height - 160) {
            this.pos.y = height - 160;
            this.vel.y *= -1;
          }

          let safeZones = [
            createVector(100, 150),
            createVector(width - 100, 150),
            createVector(100, height - 200),
            createVector(width - 100, height - 200),
          ];
          let safeR = 80;

          for (let sz of safeZones) {
            let d = dist(this.pos.x, this.pos.y, sz.x, sz.y);

            if (d < safeR + this.r) {
              let overlap = safeR + this.r - d;
              let pushDir = p5.Vector.sub(this.pos, sz).normalize();
              this.pos.add(p5.Vector.mult(pushDir, overlap));

              let n = pushDir.copy();
              let dotProd = this.vel.dot(n);
              this.vel.sub(p5.Vector.mult(n, 2 * dotProd));
            }
          }
          return;
        } else {
          if (villain) {
            let dVillain = dist(
              this.pos.x,
              this.pos.y,
              villain.pos.x,
              villain.pos.y,
            );
            if (dVillain < 250) {
              let fleeDir = p5.Vector.sub(this.pos, villain.pos)
                .normalize()
                .mult(2.0);
              this.acc.add(fleeDir);
              this.vel.limit(8);
            }
          }
        }
      } else {
        this.vel.mult(0.8);
      }
      this.vel.add(this.acc);
      this.pos.add(this.vel);
      this.applyCollision();
      return;
    }

    if (ep === 11 && this.isStatic) {
      this.acc.add(p5.Vector.sub(this.targetPos, this.pos).mult(0.1));
      this.vel.add(this.acc);
      this.vel.mult(0.8);
      this.pos.add(this.vel);
      this.applyCollision();
      return;
    }
    if (ep === 11 && this.isMe) {
      if (isDraggingMe) return;
      let seats = [
        createVector(width / 2 - 195, height / 2 - 100),
        createVector(width / 2 + 195, height / 2 - 100),
        createVector(width / 2 - 195, height / 2 + 100),
        createVector(width / 2 + 195, height / 2 + 100),
      ];
      let nearest = seats[0];
      let minD = dist(this.pos.x, this.pos.y, nearest.x, nearest.y);
      for (let s of seats) {
        let d = dist(this.pos.x, this.pos.y, s.x, s.y);
        if (d < minD) {
          minD = d;
          nearest = s;
        }
      }
      if (minD < 100) {
        this.pos.set(nearest.x, nearest.y);
        this.vel.mult(0);
      }
    }

    if (ep === 10) {
      if (this.isStatic && !this.isMe) {
        let meNode = particles[0];
        let dToMe = dist(this.pos.x, this.pos.y, meNode.pos.x, meNode.pos.y);

        if (dToMe < 150 && meNode.vel.mag() > 0.5) {
          let yieldDir = p5.Vector.sub(this.pos, meNode.pos)
            .normalize()
            .mult(2.0);
          this.acc.add(yieldDir);
          this.isYielding = true;
        } else {
          this.acc.add(p5.Vector.sub(this.targetPos, this.pos).mult(0.1));
          this.isYielding = false;
        }
        this.vel.add(this.acc);
        this.vel.mult(0.8);
        this.pos.add(this.vel);
        this.applyCollision();
        return;
      }
      if (this.isMe) {
        this.vel.mult(0);
        this.applyCollision();
        return;
      }
      if (this.isEp10Challenger) {
        if (
          dist(this.pos.x, this.pos.y, particles[0].pos.x, particles[0].pos.y) <
          150
        )
          this.acc.add(
            p5.Vector.sub(this.pos, particles[0].pos).normalize().mult(2.5),
          );
        else this.acc.add(p5.Vector.sub(this.targetPos, this.pos).mult(0.05));
        this.vel.add(this.acc);
        this.vel.mult(0.85);
        this.pos.add(this.vel);
        this.applyCollision();
        return;
      }
    }

    if (ep === 5) {
      if (this.isEp5Sitter) {
        this.vel.mult(0);
        return;
      }
      if (this.isMe) {
        if (this.ep5Seated) {
          this.vel.mult(0);
          return;
        }
        if (ep5SeatOccupied)
          this.acc.add(
            p5.Vector.sub(this.targetPos, ep5EmptySeatPos).mult(0.005),
          );
      }
      if (this.isEp5WinnerChallenger) {
        if (this.ep5Seated) {
          this.pos.set(ep5EmptySeatPos);
          this.vel.mult(0);
          return;
        }
        let dToSeat = dist(
          this.pos.x,
          this.pos.y,
          ep5EmptySeatPos.x,
          ep5EmptySeatPos.y,
        );
        if (
          episodeTimer > 20 ||
          dist(
            particles[0].pos.x,
            particles[0].pos.y,
            ep5EmptySeatPos.x,
            ep5EmptySeatPos.y,
          ) < 250
        ) {
          if (dToSeat < 15) {
            this.ep5Seated = true;
            ep5SeatOccupied = true;
            this.pos.set(ep5EmptySeatPos);
            this.vel.mult(0);
          } else {
            let dir = p5.Vector.sub(ep5EmptySeatPos, this.pos);
            dir.normalize();
            dir.mult(3.5);
            this.acc.add(dir);
          }
        }
      }
      this.vel.add(this.acc);
      this.vel.limit(this.isEp5WinnerChallenger ? 15 : 4);
      this.pos.add(this.vel);
      if ((this.isMe || this.isEp5WinnerChallenger) && !this.ep5Seated) {
        let minDistEp5 = this.r * 2 + 5;
        let d = p5.Vector.dist(particles[0].pos, ep5Winner.pos);
        if (d < minDistEp5 && d > 0) {
          let overlap = minDistEp5 - d;
          let dir = p5.Vector.sub(
            this.isMe ? particles[0].pos : ep5Winner.pos,
            this.isMe ? ep5Winner.pos : particles[0].pos,
          ).normalize();
          this.pos.add(p5.Vector.mult(dir, overlap * 0.5));
        }
      }
      return;
    }

    if (ep === 8) {
      if (ep8SubPhase === 0) {
        if (this.ep8Role === "stay") {
          this.vel.mult(0.5);
        } else if (this.ep8Role === "exit") {
          this.acc.x += (this.laneX - this.pos.x) * 0.1;
          this.acc.y += 0.8;
          if (this.pos.y > height + 50) this.isExited = true;
        } else if (this.ep8Role === "enter") {
          if (ep8ExitersClear) {
            this.acc.x += (this.targetPos.x - this.pos.x) * 0.1;
            this.acc.y -= 0.8;
            if (this.pos.y < this.targetPos.y + 20) {
              this.vel.mult(0.6);
              this.ep8Role = "stay";
            }
          } else {
            this.acc.add(
              p5.Vector.sub(
                createVector(this.laneX, this.pos.y),
                this.pos,
              ).mult(0.1),
            );
            this.vel.mult(0.8);
          }
        }
      } else if (ep8SubPhase === 1) {
        if (this.pos.y < -50) {
          if (this.isMe) {
            this.vel.mult(0);
            this.acc.mult(0);
            return;
          } else {
            this.pos.y = height + 50;
          }
        }

        if (this.ep8Role !== "exit" && !this.isMe) {
          this.isExited = true;
          return;
        }
        this.acc.x += (this.laneX - this.pos.x) * 0.3;
        this.acc.y -= 0.6;
      }
      this.vel.add(this.acc);
      this.vel.limit(6);
      this.pos.add(this.vel);
      this.applyCollision();
      return;
    }

    if (ep === 1 || ep === 6) {
      this.pos.x = lerp(this.pos.x, this.targetPos.x, 0.08);
      this.pos.y = lerp(this.pos.y, this.targetPos.y, 0.08);
      this.vel.mult(0);
      this.applyCollision();
      return;
    }

    this.acc.x += map(noise(this.noiseOffset, time * 0.005), 0, 1, -0.1, 0.1);
    this.acc.y += map(
      noise(this.noiseOffset + 1000, time * 0.005),
      0,
      1,
      -0.1,
      0.1,
    );

    if (ep === 2) {
      this.acc.x += sin(time * 0.6 + this.noiseOffset) * 25.0;
      this.acc.add(p5.Vector.sub(center, this.pos).mult(0.003));
      if (mouseIsPressed && !this.isMe) {
        if (dist(mouseX, mouseY, this.pos.x, this.pos.y) < this.r + 80) {
          this.pos.add(
            p5.Vector.sub(this.pos, createVector(mouseX, mouseY))
              .normalize()
              .mult(10),
          );
        }
      }
    } else if (ep === 4) {
      if (time === 50) this.vel.x += random(60, 90);
      this.acc.x += 0.45;
      if (this.isMe) this.personalSpace *= 0.985;
    } else if (ep === 9 || ep === 15) {
      let targetY = height * 0.3;
      if (this.pos.y > targetY) {
        this.acc.y -= 0.3;
      } else {
        this.vel.y *= 0.9;
      }
      this.acc.x += map(
        noise(this.noiseOffset, time * 0.01),
        0,
        1,
        -0.05,
        0.05,
      );
    }

    if (ep === 11 && !this.isMe) {
      let meNode = particles[0];
      if (isAtEndSeat(meNode.pos.x, meNode.pos.y)) {
        if (dist(this.pos.x, this.pos.y, meNode.pos.x, meNode.pos.y) < 150) {
          this.vel.mult(0.1);
          let pushDir = p5.Vector.sub(this.pos, meNode.pos)
            .normalize()
            .mult(2.5);
          this.acc.add(pushDir);
        }
      }
    }

    this.vel.add(this.acc);
    this.vel.limit(this.isMe ? 3 : 2.5);
    if (ep === 12) {
      if (this.isMe) {
        if (isDraggingMe) flowMultiplier = lerp(flowMultiplier, 2.5, 0.05);
        else flowMultiplier = lerp(flowMultiplier, 0.2, 0.05);
      }
      this.vel.mult(flowMultiplier);
      this.vel.limit(this.isMe ? 8 : 5);
    }
    this.pos.add(this.vel);
    this.applyCollision();

    if (ep !== 8) {
      if (this.pos.x < 50) this.pos.x = 50;
      if (this.pos.x > width - 50) this.pos.x = width - 50;
      if (this.pos.y < 50) this.pos.y = 50;
      if (this.pos.y > height - 150) this.pos.y = height - 150;
    }
  }

  display(ep, time) {
    if (this.isExited) return;
    push();
    translate(this.pos.x, this.pos.y);
    noStroke();

    if (ep === 13) {
      if (this.isPreacher) {
        fill(255, 60, 60);
        circle(0, 0, this.r * 2);

        noFill();
        stroke(255, 60, 60, 120);
        strokeWeight(4);

        circle(0, 0, this.r * 2 + (frameCount % 30) * 3);
      } else if (this.isMe) {
        if (this.isIndifferent) {
          fill(150);
        } else if (this.isStressed) {
          fill(255, 100, 100);
        } else {
          fill(color(lineColors[currentLine]));
        }

        circle(0, 0, this.r * 2);
      } else {
        if (this.isIndifferent) {
          fill(120);
        } else {
          fill(180);
        }

        circle(0, 0, this.r * 2);
      }

      pop();
      return;
    }

    if (ep === 14) {
      if (this.isMe) fill(color(lineColors[currentLine]));
      else fill(0, 180);
      circle(0, 0, this.r * 2);
      pop();
      return;
    }

    if (ep === 7 && this.isMe && this.isSafe) {
      noFill();
      stroke(100, 255, 150, 200);
      strokeWeight(2);
      circle(0, 0, this.r * 2 + 15);
    }

    if (ep === 10 && this.isYielding && !this.isMe) {
      noFill();
      stroke(255, 200, 100, 180);
      strokeWeight(4);
      drawingContext.shadowBlur = 15;
      drawingContext.shadowColor = color(255, 200, 100);
      circle(0, 0, this.r * 2 + 20 + sin(frameCount * 0.2) * 5);
      drawingContext.shadowBlur = 0;
    }

    if (ep === 4 && this.isMe && this.personalSpace > 5) {
      noFill();
      stroke(120, 180, 255, 40);
      strokeWeight(2);
      circle(0, 0, this.r * 2 + this.personalSpace);
    }

    if (ep === 11 && this.isMe) {
      if (isAtEndSeat(this.pos.x, this.pos.y)) {
        fill(200, 230, 255, 60);
        circle(0, 0, 260);
        fill(200, 230, 255, 20);
        circle(0, 0, 340);
      }
    }

    if (ep === 1) {
      if (this.isMe) {
        if (this.contentState === 1) {
          let glowAlpha = map(ep1Immersion, 0, 1, 0, 255);
          drawingContext.shadowBlur = 30;
          drawingContext.shadowColor = `rgba(255, 255, 200, ${ep1Immersion})`;

          let grad = drawingContext.createRadialGradient(
            0,
            0,
            this.r,
            0,
            0,
            this.r * 5,
          );
          grad.addColorStop(0, `rgba(255, 255, 200, ${ep1Immersion * 0.4})`);
          grad.addColorStop(1, `rgba(255, 255, 200, 0)`);
          noStroke();
          drawingContext.fillStyle = grad;
          circle(0, 0, this.r * 10);
          drawingContext.shadowBlur = 0;
        }

        let myBaseCol = color(lineColors[currentLine]);
        let myCol = lerpColor(
          myBaseCol,
          color(200, 220, 255),
          ep1Immersion * 0.4,
        );
        fill(myCol);
        if (ep1Immersion > 0.01) {
          stroke(255, 255, 200, ep1Immersion * 150);
          strokeWeight(2);
        } else {
          noStroke();
        }
        circle(0, 0, this.r * 2);
        noStroke();

        if (this.contentState === 1) {
          fill(255, 255, 230);
          rectMode(CENTER);
          rect(0, this.r + 25, 24, 40, 4);
          fill(255, 255, 200, 80 * ep1Immersion);
          circle(0, this.r + 25, 60);
        } else {
          fill(0, 30);
          circle(0, this.r + 25, 12);
          fill(0, 15);
          circle(0, this.r + 25, 16);
        }
      } else {
        let otherCol = lerpColor(color(0), color(60, 60, 80), ep1Immersion);
        fill(otherCol);
        circle(0, 0, this.r * 2);

        let phoneCol = lerpColor(color(80), color(100, 100, 120), ep1Immersion);
        fill(phoneCol);
        circle(0, this.r + 25, 10);
      }
      pop();
      return;
    }

    if (ep === 6) {
      if (this.isMe) fill(color(lineColors[currentLine]));
      else {
        if (particles[0].hasShield) fill(0, 40);
        else fill(0);
      }
      circle(0, 0, this.r * 2);

      if (this.isMe) {
        if (!this.hasShield) {
          noFill();
          stroke(0, map(sin(time * 0.1 + this.noiseOffset), -1, 1, 0, 70));
          strokeWeight(1.5);
          circle(0, 0, this.r * 2 + 10 + (time % 20));
        } else {
          let t = time * 0.05;
          let bounce = sin(t) * 45;
          noFill();
          strokeWeight(4);
          for (let i = 0; i < 3; i++) {
            let offset = i * 20;
            stroke(100, 200, 255, 150 + sin(t + i) * 80);
            circle(0, 0, this.r * 2.5 + bounce + offset);
          }
          fill(255, 50);
          circle(0, 0, this.r * 2.5 + bounce);
        }
      }
      pop();
      return;
    }

    let a = this.alpha !== undefined ? this.alpha : 180;
    if (this.isMe) {
      if (ep === 9 && this.isSunsetTinted) fill(255, 150, 80, 220);
      else fill(color(lineColors[currentLine]));
    } else {
      if (ep === 9) {
        let base = color(0, a);
        let tint = color(255, 150, 80, a);
        fill(lerpColor(base, tint, min(time / 200, 1)));
      } else if (ep === 7 && this.isVillain) fill(0, min(a + 75, 255));
      else if (ep === 15) fill(120, a);
      else fill(0, a);
    }

    circle(0, 0, this.r * 2);
    pop();
  }
}
