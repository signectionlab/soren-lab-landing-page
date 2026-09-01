/**
 * SOREN LAB 문의폼 → Google Sheets + 메일 알림 + 관리자 API
 *
 * [Script Properties]
 * SHEET_NAME   : 시트 탭 이름
 * ADMIN_EMAIL  : 알림 수신 이메일
 * ADMIN_TOKEN  : 관리자 페이지 접속 토큰
 *
 * [Admin API — doGet]
 * ?action=list&token=...&callback=...   문의 목록 (JSONP)
 * ?action=update&token=...&row=...&status=...&memo=...&callback=...  수정 (JSONP)
 * ?action=delete&token=...&row=...&callback=...  삭제 (JSONP)
 */

var COL = {
  ID: 1,
  DATE: 2,
  TYPE: 3,
  COMPANY: 4,
  NAME: 5,
  EMAIL: 6,
  MESSAGE: 7,
  PRIVACY: 8,
  MEMO: 10,
  SOURCE: 11,
  STATUS: 12,
};

var STATUS_LABELS = {
  NEW: "신규",
  CONTACTED: "연락완료",
  IN_PROGRESS: "상담중",
  PROPOSAL: "제안발송",
  COMPLETED: "완료",
  ON_HOLD: "보류",
  CLOSED: "종료",
};

function getConfig() {
  var props = PropertiesService.getScriptProperties();
  var sheetName = props.getProperty("SHEET_NAME");
  var adminEmail = props.getProperty("ADMIN_EMAIL");

  if (!sheetName || !adminEmail) {
    throw new Error(
      "Script Properties에 SHEET_NAME, ADMIN_EMAIL을 설정하세요."
    );
  }

  return {
    SHEET_NAME: sheetName,
    ADMIN_EMAIL: adminEmail,
  };
}

function getAdminToken() {
  return PropertiesService.getScriptProperties().getProperty("ADMIN_TOKEN") || "";
}

function verifyAdminToken(token) {
  var expected = getAdminToken();
  if (!expected) {
    throw new Error("ADMIN_TOKEN이 Script Properties에 설정되지 않았습니다.");
  }
  if (!token || token !== expected) {
    throw new Error("관리자 인증에 실패했습니다.");
  }
}

function getSheet_() {
  var config = getConfig();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.SHEET_NAME);
  if (!sheet) {
    throw new Error("시트를 찾을 수 없습니다: " + config.SHEET_NAME);
  }
  return sheet;
}

function padRow_(row, length) {
  while (row.length < length) {
    row.push("");
  }
  return row;
}

function rowToInquiry_(rowIndex, row) {
  row = padRow_(row, COL.STATUS);
  return {
    row: rowIndex,
    id: row[COL.ID - 1] || "",
    date: row[COL.DATE - 1] || "",
    type: row[COL.TYPE - 1] || "",
    company: row[COL.COMPANY - 1] || "",
    name: row[COL.NAME - 1] || "",
    email: row[COL.EMAIL - 1] || "",
    message: row[COL.MESSAGE - 1] || "",
    privacy: row[COL.PRIVACY - 1] || "",
    memo: row[COL.MEMO - 1] || "",
    source: row[COL.SOURCE - 1] || "",
    status: row[COL.STATUS - 1] || row[8] || "NEW",
    statusLabel: STATUS_LABELS[row[COL.STATUS - 1] || row[8]] || row[COL.STATUS - 1] || row[8] || "신규",
  };
}

function adminListInquiries(token) {
  verifyAdminToken(token);
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { success: true, inquiries: [] };
  }

  var values = sheet.getRange(2, 1, lastRow - 1, COL.STATUS).getValues();
  var inquiries = values.map(function (row, i) {
    return rowToInquiry_(i + 2, row);
  });

  inquiries.reverse();
  return { success: true, inquiries: inquiries };
}

function adminUpdateInquiry(token, rowIndex, status, memo) {
  verifyAdminToken(token);
  var sheet = getSheet_();
  var row = parseInt(rowIndex, 10);
  if (!row || row < 2) {
    throw new Error("유효하지 않은 행 번호입니다.");
  }
  if (row > sheet.getLastRow()) {
    throw new Error("해당 문의를 찾을 수 없습니다.");
  }

  if (status !== undefined && status !== null && status !== "") {
    if (!STATUS_LABELS[status] && status !== "NEW") {
      throw new Error("유효하지 않은 상태값입니다.");
    }
    sheet.getRange(row, COL.STATUS).setValue(status);
  }

  if (memo !== undefined && memo !== null) {
    sheet.getRange(row, COL.MEMO).setValue(String(memo));
  }

  var updatedRow = sheet.getRange(row, 1, 1, COL.STATUS).getValues()[0];
  return {
    success: true,
    inquiry: rowToInquiry_(row, updatedRow),
  };
}

function adminDeleteInquiry(token, rowIndex) {
  verifyAdminToken(token);
  var sheet = getSheet_();
  var row = parseInt(rowIndex, 10);
  if (!row || row < 2) {
    throw new Error("유효하지 않은 행 번호입니다.");
  }
  if (row > sheet.getLastRow()) {
    throw new Error("해당 문의를 찾을 수 없습니다.");
  }

  sheet.deleteRow(row);
  return { success: true, row: row };
}

const INQUIRY_TYPE_MAP = {
  product: "제품",
  oem: "OEM / ODM",
  partnership: "파트너십",
  other: "기타",
};

function normalizeParams(params) {
  if (!params || typeof params !== "object") {
    params = {};
  }

  return {
    company: params.company || "",
    name: params.name || "",
    email: params.email || "",
    inquiryType: params.inquiryType || "",
    message: params.message || "",
    privacy: params.privacy === "true" || params.privacy === "on" || params.privacy === true,
  };
}

function parseRequestData(e) {
  if (!e) {
    throw new Error("요청 데이터가 없습니다.");
  }

  if (e.parameter && e.parameter.action) {
    return e.parameter;
  }

  if (e.parameter && e.parameter.company) {
    return normalizeParams(e.parameter);
  }

  if (e.postData && e.postData.contents) {
    if (e.postData.type === "application/json") {
      return JSON.parse(e.postData.contents);
    }

    var pairs = e.postData.contents.split("&");
    var params = {};
    pairs.forEach(function (pair) {
      var parts = pair.split("=");
      var key = decodeURIComponent(parts[0].replace(/\+/g, " "));
      var value = decodeURIComponent((parts[1] || "").replace(/\+/g, " "));
      params[key] = value;
    });
    return params;
  }

  throw new Error("전송된 데이터를 읽을 수 없습니다.");
}

function processInquiry(data) {
  var normalized = normalizeParams(data);
  var sheet = getSheet_();
  var now = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
  var inquiryType = INQUIRY_TYPE_MAP[normalized.inquiryType] || normalized.inquiryType || "";
  var newId = Math.max(sheet.getLastRow(), 1);

  var row = new Array(COL.STATUS).fill("");
  row[COL.ID - 1] = newId;
  row[COL.DATE - 1] = now;
  row[COL.TYPE - 1] = inquiryType;
  row[COL.COMPANY - 1] = normalized.company;
  row[COL.NAME - 1] = normalized.name;
  row[COL.EMAIL - 1] = normalized.email;
  row[COL.MESSAGE - 1] = normalized.message;
  row[COL.PRIVACY - 1] = normalized.privacy ? "TRUE" : "FALSE";
  row[COL.MEMO - 1] = "";
  row[COL.SOURCE - 1] = "landing_page";
  row[COL.STATUS - 1] = "NEW";

  sheet.appendRow(row);

  try {
    sendInquiryEmail({
      id: newId,
      createdAt: now,
      inquiryType: inquiryType,
      company: normalized.company,
      name: normalized.name,
      email: normalized.email,
      message: normalized.message,
      privacy: normalized.privacy ? "동의" : "미동의",
    });
  } catch (mailError) {
    Logger.log("메일 발송 실패: " + mailError.message);
  }

  return { success: true, id: newId };
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function jsonpResponse(callback, payload) {
  var safeCallback = (callback || "callback").replace(/[^\w$.]/g, "");
  return ContentService.createTextOutput(
    safeCallback + "(" + JSON.stringify(payload) + ")"
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function handleAdminAction(params) {
  var action = params.action;
  var token = params.token;

  if (action === "list") {
    return adminListInquiries(token);
  }

  if (action === "update") {
    return adminUpdateInquiry(token, params.row, params.status, params.memo);
  }

  if (action === "delete") {
    return adminDeleteInquiry(token, params.row);
  }

  throw new Error("알 수 없는 action입니다.");
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};

    if (params.action === "list" || params.action === "update" || params.action === "delete") {
      var result = handleAdminAction(params);
      if (params.callback) {
        return jsonpResponse(params.callback, result);
      }
      return jsonResponse(result);
    }

    if (params.company) {
      processInquiry(params);
      return ContentService.createTextOutput("OK");
    }

    return ContentService.createTextOutput("SOREN LAB Inquiry API is running.");
  } catch (error) {
    Logger.log("doGet 오류: " + error.message);
    var errPayload = { success: false, error: error.message };
    if (e && e.parameter && e.parameter.callback) {
      return jsonpResponse(e.parameter.callback, errPayload);
    }
    return jsonResponse(errPayload);
  }
}

function doPost(e) {
  try {
    var data = parseRequestData(e);

    if (data.action) {
      var result = handleAdminAction(data);
      return jsonResponse(result);
    }

    var result = processInquiry(data);
    return jsonResponse(result);
  } catch (error) {
    Logger.log("doPost 오류: " + error.message);
    return jsonResponse({ success: false, error: error.message });
  }
}

function sendInquiryEmail(inquiry) {
  var config = getConfig();
  var subject = "[SOREN LAB] 새 문의가 접수되었습니다 - " + inquiry.company;
  var body =
    "SOREN LAB 랜딩페이지에 새로운 B2B 문의가 접수되었습니다.\n\n" +
    "번호: " +
    inquiry.id +
    "\n" +
    "접수일시: " +
    inquiry.createdAt +
    "\n" +
    "문의유형: " +
    inquiry.inquiryType +
    "\n" +
    "회사명: " +
    inquiry.company +
    "\n" +
    "담당자: " +
    inquiry.name +
    "\n" +
    "이메일: " +
    inquiry.email +
    "\n" +
    "개인정보동의: " +
    inquiry.privacy +
    "\n\n" +
    "문의 내용:\n" +
    inquiry.message +
    "\n\n" +
    SpreadsheetApp.getActiveSpreadsheet().getUrl();

  MailApp.sendEmail({
    to: config.ADMIN_EMAIL,
    subject: subject,
    body: body,
    name: "SOREN LAB 문의 알림",
    replyTo: inquiry.email || config.ADMIN_EMAIL,
  });
}

function testAppendRow() {
  var result = processInquiry({
    company: "테스트 회사",
    name: "홍길동",
    email: "test@example.com",
    inquiryType: "oem",
    message: "Apps Script 테스트 문의입니다.",
    privacy: true,
  });
  Logger.log(result);
}

function testAdminList() {
  var token = getAdminToken();
  Logger.log(adminListInquiries(token));
}

function testDoGetMock() {
  var result = doGet({
    parameter: {
      company: "테스트 회사",
      name: "홍길동",
      email: "test@example.com",
      inquiryType: "oem",
      message: "doGet mock 테스트입니다.",
      privacy: "true",
    },
  });
  Logger.log(result.getContent());
}

function testSendInquiryEmail() {
  sendInquiryEmail({
    id: 999,
    createdAt: Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss"),
    inquiryType: "OEM / ODM",
    company: "테스트 회사",
    name: "홍길동",
    email: "test@example.com",
    message: "메일 알림 테스트 문의입니다.",
    privacy: "동의",
  });
}
