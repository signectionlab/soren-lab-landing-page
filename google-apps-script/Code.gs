/**
 * SOREN LAB 문의폼 → Google Sheets + 메일 알림
 *
 * [Apps Script 테스트 방법]
 * 상단 함수 선택 → testAppendRow → 실행 (시트 저장 테스트)
 * 상단 함수 선택 → testSendInquiryEmail → 실행 (메일 테스트)
 *
 * doGet / doPost 는 직접 실행하지 마세요. (인자 없어서 오류 납니다)
 *
 * [Script Properties 설정 — Apps Script 편집기 → 프로젝트 설정]
 * SHEET_NAME  : 시트 탭 이름
 * ADMIN_EMAIL : 알림 수신 이메일
 */

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  const sheetName = props.getProperty("SHEET_NAME");
  const adminEmail = props.getProperty("ADMIN_EMAIL");

  if (!sheetName || !adminEmail) {
    throw new Error(
      "Script Properties에 SHEET_NAME, ADMIN_EMAIL을 설정하세요. " +
        "google-apps-script/script.properties.example 참고"
    );
  }

  return {
    SHEET_NAME: sheetName,
    ADMIN_EMAIL: adminEmail,
  };
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

  if (e.parameter && e.parameter.company) {
    return normalizeParams(e.parameter);
  }

  if (e.postData && e.postData.contents) {
    if (e.postData.type === "application/json") {
      const parsed = JSON.parse(e.postData.contents);
      return normalizeParams(parsed);
    }

    const pairs = e.postData.contents.split("&");
    const params = {};
    pairs.forEach(function (pair) {
      const parts = pair.split("=");
      const key = decodeURIComponent(parts[0].replace(/\+/g, " "));
      const value = decodeURIComponent((parts[1] || "").replace(/\+/g, " "));
      params[key] = value;
    });
    return normalizeParams(params);
  }

  throw new Error("전송된 폼 데이터를 읽을 수 없습니다.");
}

function processInquiry(data) {
  const normalized = normalizeParams(data);

  const config = getConfig();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.SHEET_NAME);
  if (!sheet) {
    const names = SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function (s) {
      return s.getName();
    });
    throw new Error(
      "시트를 찾을 수 없습니다: " + config.SHEET_NAME + " / 현재 탭: " + names.join(", ")
    );
  }

  const now = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
  const inquiryType = INQUIRY_TYPE_MAP[normalized.inquiryType] || normalized.inquiryType || "";
  const newId = Math.max(sheet.getLastRow(), 1);

  sheet.appendRow([
    newId,
    now,
    inquiryType,
    normalized.company,
    normalized.name,
    normalized.email,
    normalized.message,
    normalized.privacy ? "TRUE" : "FALSE",
    "NEW",
    "",
    "landing_page",
  ]);

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
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.company) {
      processInquiry(e.parameter);
      return ContentService.createTextOutput("OK");
    }
    return ContentService.createTextOutput("SOREN LAB Inquiry API is running.");
  } catch (error) {
    Logger.log("doGet 오류: " + error.message);
    return ContentService.createTextOutput("ERROR: " + error.message);
  }
}

function doPost(e) {
  try {
    const data = parseRequestData(e);
    const result = processInquiry(data);
    return jsonResponse(result);
  } catch (error) {
    Logger.log("doPost 오류: " + error.message);
    return jsonResponse({ success: false, error: error.message });
  }
}

function sendInquiryEmail(inquiry) {
  const config = getConfig();
  const subject = "[SOREN LAB] 새 문의가 접수되었습니다 - " + inquiry.company;
  const body =
    "SOREN LAB 랜딩페이지에 새로운 B2B 문의가 접수되었습니다.\n\n" +
    "번호: " + inquiry.id + "\n" +
    "접수일시: " + inquiry.createdAt + "\n" +
    "문의유형: " + inquiry.inquiryType + "\n" +
    "회사명: " + inquiry.company + "\n" +
    "담당자: " + inquiry.name + "\n" +
    "이메일: " + inquiry.email + "\n" +
    "개인정보동의: " + inquiry.privacy + "\n\n" +
    "문의 내용:\n" + inquiry.message + "\n\n" +
    SpreadsheetApp.getActiveSpreadsheet().getUrl();

  MailApp.sendEmail({
    to: config.ADMIN_EMAIL,
    subject: subject,
    body: body,
    name: "SOREN LAB 문의 알림",
    replyTo: inquiry.email || config.ADMIN_EMAIL,
  });
}

/** 시트 저장 + 메일 알림 통합 테스트 (이 함수를 실행하세요) */
function testAppendRow() {
  const result = processInquiry({
    company: "테스트 회사",
    name: "홍길동",
    email: "test@example.com",
    inquiryType: "oem",
    message: "Apps Script 테스트 문의입니다.",
    privacy: true,
  });
  Logger.log(result);
}

/** Web App GET 방식 시뮬레이션 테스트 */
function testDoGetMock() {
  const result = doGet({
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

/** 메일만 단독 테스트 */
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
