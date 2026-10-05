const ALLOWED_ORIGINS = [
  "https://youthdeveloping.github.io",
  "https://youthdeveloping.github.io/pjy",
  "https://pjy-server.github.io"
];

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const PBKDF2_ITERATIONS = 100000;

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY = 8;
const MAX_HISTORY_TEXT_LENGTH = 600;
const MAX_OUTPUT_TOKENS = 350;

const MAX_CHAR_FIELD_LENGTH = 500;
const MAX_CHARACTERS_RETURNED = 200;

const MAX_CHAT_MESSAGES = 100;
const MAX_REPORT_DETAIL = 1000;

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

const MODEL_FALLBACK_CHAIN = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest"
];

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY = 1200;


// ============================================================
// CORS
// ============================================================

function corsHeaders(origin) {
  const allowedOrigin =
    ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods":
      "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Content-Type":
      "application/json; charset=utf-8"
  };
}

function json(data, status, origin) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: corsHeaders(origin)
    }
  );
}


// ============================================================
// 기본 유틸
// ============================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(
      hex.substring(i * 2, i * 2 + 2),
      16
    );
  }

  return bytes;
}

function randomHex(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function sanitizeField(value, fallback = "") {
  return String(value ?? fallback)
    .trim()
    .slice(0, MAX_CHAR_FIELD_LENGTH);
}

function getBearerToken(request) {
  const header =
    request.headers.get("Authorization") || "";

  const match =
    header.match(/^Bearer\s+(.+)$/i);

  return match
    ? match[1].trim()
    : null;
}


// ============================================================
// PASSWORD
// ============================================================

async function hashPassword(password, saltHex) {

  const keyMaterial =
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

  const bits =
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: hexToBytes(saltHex),
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );

  return bytesToHex(
    new Uint8Array(bits)
  );
}


// ============================================================
// GEMINI
// ============================================================

class GeminiError extends Error {

  constructor(message, status, fallback) {
    super(message);

    this.status = status;
    this.fallback = fallback;
  }
}


async function getGeminiError(response) {

  let text = "";

  try {
    text = await response.text();
  } catch {}

  try {

    const data = JSON.parse(text);

    return (
      data?.error?.message ||
      data?.error?.status ||
      text ||
      `HTTP ${response.status}`
    );

  } catch {

    return text ||
      `HTTP ${response.status}`;
  }
}


async function callGeminiModel({
  apiKey,
  model,
  systemPrompt,
  contents
}) {

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const body = {

    systemInstruction: {
      parts: [
        {
          text: systemPrompt
        }
      ]
    },

    contents,

    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      maxOutputTokens: MAX_OUTPUT_TOKENS,

      thinkingConfig: {
        thinkingBudget: 0
      }
    }
  };


  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt++
  ) {

    const response =
      await fetch(
        url,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },

          body: JSON.stringify(body)
        }
      );


    if (response.ok) {

      const data =
        await response.json();

      const reply =
        data?.candidates?.[0]?.content?.parts
          ?.filter(part => !part.thought)
          ?.map(part => part.text || "")
          ?.join("")
          ?.trim();

      if (!reply) {

        throw new GeminiError(
          "AI가 답변을 생성하지 못했습니다.",
          response.status,
          false
        );
      }

      return reply;
    }


    const message =
      await getGeminiError(response);


    if (response.status === 429) {

      throw new GeminiError(
        "Gemini API 사용량 제한에 도달했습니다.",
        429,
        true
      );
    }


    if (
      response.status === 503 ||
      response.status === 500 ||
      response.status === 502 ||
      response.status === 504
    ) {

      if (attempt >= MAX_RETRIES) {

        throw new GeminiError(
          `Gemini 서버 오류 (${response.status})`,
          response.status,
          true
        );
      }

      await sleep(
        RETRY_BASE_DELAY * (attempt + 1)
      );

      continue;
    }


    throw new GeminiError(
      `Gemini API 오류 (${response.status}): ${message}`,
      response.status,
      false
    );
  }


  throw new GeminiError(
    "Gemini 요청에 실패했습니다.",
    500,
    true
  );
}


async function callGemini({
  apiKey,
  systemPrompt,
  contents
}) {

  let lastError = null;

  for (
    const model of MODEL_FALLBACK_CHAIN
  ) {

    try {

      return await callGeminiModel({
        apiKey,
        model,
        systemPrompt,
        contents
      });

    } catch (error) {

      lastError = error;

      if (
        !(error instanceof GeminiError) ||
        !error.fallback
      ) {
        throw error;
      }
    }
  }

  throw lastError ||
    new Error("모든 Gemini 모델이 실패했습니다.");
}


// ============================================================
// CHAT
// ============================================================

async function handleChat(
  request,
  env,
  origin
) {

  if (!env.GEMINI_API_KEY) {

    return json(
      {
        error:
          "GEMINI_API_KEY가 Worker에 설정되지 않았습니다."
      },
      500,
      origin
    );
  }


  let body;

  try {

    body = await request.json();

  } catch {

    return json(
      {
        error:
          "잘못된 JSON 요청입니다."
      },
      400,
      origin
    );
  }


  let message =
    String(
      body.message ||
      body.user_message ||
      ""
    ).trim();


  if (!message) {

    return json(
      {
        error:
          "메시지를 입력해주세요."
      },
      400,
      origin
    );
  }


  message =
    message.substring(
      0,
      MAX_MESSAGE_LENGTH
    );


  const character =
    body.character || {};


  const characterName =
    String(
      character.name ||
      body.characterName ||
      "AI 캐릭터"
    );

  const personality =
    String(
      character.personality ||
      body.personality ||
      "친근하고 자연스럽게 대화하는 캐릭터"
    );

  const scenario =
    String(
      character.scenario ||
      body.scenario ||
      "사용자와 자유롭게 대화한다."
    );

  const firstMessage =
    String(
      character.firstMessage ||
      body.firstMessage ||
      ""
    );


  const systemPrompt = `
너는 ZETA AI 캐릭터 채팅 플랫폼의 캐릭터다.

캐릭터 이름:
${characterName}

성격:
${personality}

상황:
${scenario}

첫 대사:
${firstMessage}

사용자와 실제 사람이 대화하는 것처럼 자연스럽게 대화해라.

규칙:

1. 캐릭터의 성격을 유지한다.
2. 사용자의 말을 정확하게 이해한다.
3. 질문에는 직접 답한다.
4. 같은 문장이나 템플릿을 반복하지 않는다.
5. 이전 대화 내용을 참고한다.
6. 캐릭터 설정을 유지한다.
7. 실제 대화체를 사용한다.
8. 특별한 이유가 없다면 AI라는 사실을 언급하지 않는다.
9. 자연스러운 한국어를 사용한다.
10. 필요 이상으로 길게 답하지 않는다.
11. 사용자가 짧게 말하면 짧게 답한다.

캐릭터 설정을 설명하지 말고
그 캐릭터 자체가 되어 대화해라.
`.trim();


  const rawHistory =
    Array.isArray(body.history)
      ? body.history
      : [];


  const contents = [];


  for (
    const item of rawHistory.slice(-MAX_HISTORY)
  ) {

    if (!item) continue;

    const rawRole =
      item.role ||
      (
        item.sender === "user"
          ? "user"
          : "assistant"
      );

    let text =
      String(
        item.text ??
        item.content ??
        ""
      ).trim();

    if (!text) continue;

    text =
      text.substring(
        0,
        MAX_HISTORY_TEXT_LENGTH
      );


    const role =
      (
        rawRole === "assistant" ||
        rawRole === "ai"
      )
        ? "model"
        : "user";


    contents.push({
      role,
      parts: [
        {
          text
        }
      ]
    });
  }


  contents.push({
    role: "user",
    parts: [
      {
        text: message
      }
    ]
  });


  try {

    const reply =
      await callGemini({
        apiKey: env.GEMINI_API_KEY,
        systemPrompt,
        contents
      });

    return json(
      { reply },
      200,
      origin
    );

  } catch (error) {

    return json(
      {
        error:
          error?.message ||
          "AI 응답에 실패했습니다."
      },
      502,
      origin
    );
  }
}


// ============================================================
// AUTH
// ============================================================

function requireUsersKV(env, origin) {

  if (!env.ZETA_USERS) {

    return json(
      {
        error:
          "ZETA_USERS KV가 연결되지 않았습니다."
      },
      500,
      origin
    );
  }

  return null;
}


async function createSession(
  env,
  username
) {

  const token =
    randomHex(32);

  await env.ZETA_USERS.put(
    `session:${token}`,
    username,
    {
      expirationTtl:
        SESSION_TTL_SECONDS
    }
  );

  return token;
}


async function getCurrentUser(
  request,
  env
) {

  const token =
    getBearerToken(request);

  if (!token) return null;

  const username =
    await env.ZETA_USERS.get(
      `session:${token}`
    );

  if (!username) return null;

  const raw =
    await env.ZETA_USERS.get(
      `user:${username}`
    );

  if (!raw) return null;

  try {

    return {
      token,
      user: JSON.parse(raw)
    };

  } catch {

    return null;
  }
}


async function handleSignup(
  request,
  env,
  origin
) {

  const kvError =
    requireUsersKV(env, origin);

  if (kvError) return kvError;


  let body;

  try {
    body = await request.json();
  } catch {
    return json(
      {
        error:
          "잘못된 JSON 요청입니다."
      },
      400,
      origin
    );
  }


  const usernameRaw =
    String(body.username || "")
      .trim();

  const username =
    usernameRaw.toLowerCase();

  const nickname =
    String(body.nickname || "")
      .trim();

  const password =
    String(body.password || "");


  if (!USERNAME_REGEX.test(usernameRaw)) {

    return json(
      {
        error:
          "아이디는 영문, 숫자, 밑줄(_)만 사용해 3~20자로 입력해주세요."
      },
      400,
      origin
    );
  }


  if (!nickname) {

    return json(
      {
        error:
          "닉네임을 입력해주세요."
      },
      400,
      origin
    );
  }


  if (nickname.length > 20) {

    return json(
      {
        error:
          "닉네임은 20자 이하로 입력해주세요."
      },
      400,
      origin
    );
  }


  if (password.length < 6) {

    return json(
      {
        error:
          "비밀번호는 6자 이상이어야 합니다."
      },
      400,
      origin
    );
  }


  if (password.length > 100) {

    return json(
      {
        error:
          "비밀번호가 너무 깁니다."
      },
      400,
      origin
    );
  }


  const existing =
    await env.ZETA_USERS.get(
      `user:${username}`
    );


  if (existing) {

    return json(
      {
        error:
          "이미 사용 중인 아이디입니다."
      },
      409,
      origin
    );
  }


  const salt =
    randomHex(16);

  const passwordHash =
    await hashPassword(
      password,
      salt
    );


  const user = {

    username,

    nickname,

    salt,

    passwordHash,

    status: "active",

    createdAt: Date.now()
  };


  await env.ZETA_USERS.put(
    `user:${username}`,
    JSON.stringify(user)
  );


  const token =
    await createSession(
      env,
      username
    );


  return json(
    {
      token,

      user: {
        username,
        nickname
      }
    },
    200,
    origin
  );
}


async function handleLogin(
  request,
  env,
  origin
) {

  const kvError =
    requireUsersKV(env, origin);

  if (kvError) return kvError;


  let body;

  try {
    body = await request.json();
  } catch {
    return json(
      {
        error:
          "잘못된 JSON 요청입니다."
      },
      400,
      origin
    );
  }


  const username =
    String(body.username || "")
      .trim()
      .toLowerCase();

  const password =
    String(body.password || "");


  const raw =
    await env.ZETA_USERS.get(
      `user:${username}`
    );


  if (!raw) {

    return json(
      {
        error:
          "아이디 또는 비밀번호가 일치하지 않습니다."
      },
      401,
      origin
    );
  }


  let user;

  try {
    user = JSON.parse(raw);
  } catch {
    return json(
      {
        error:
          "사용자 데이터가 손상되었습니다."
      },
      500,
      origin
    );
  }


  const hash =
    await hashPassword(
      password,
      user.salt
    );


  if (hash !== user.passwordHash) {

    return json(
      {
        error:
          "아이디 또는 비밀번호가 일치하지 않습니다."
      },
      401,
      origin
    );
  }


  if (
    (user.status || "active") ===
    "suspended"
  ) {

    return json(
      {
        error:
          "정지된 계정입니다. 관리자에게 문의해주세요."
      },
      403,
      origin
    );
  }


  const token =
    await createSession(
      env,
      username
    );


  return json(
    {
      token,

      user: {
        username: user.username,
        nickname: user.nickname
      }
    },
    200,
    origin
  );
}


async function handleMe(
  request,
  env,
  origin
) {

  const session =
    await getCurrentUser(
      request,
      env
    );


  if (!session) {

    return json(
      {
        error:
          "세션이 만료되었습니다."
      },
      401,
      origin
    );
  }


  const {
    token,
    user
  } = session;


  if (
    (user.status || "active") ===
    "suspended"
  ) {

    await env.ZETA_USERS.delete(
      `session:${token}`
    );

    return json(
      {
        error:
          "정지된 계정입니다."
      },
      403,
      origin
    );
  }


  return json(
    {
      user: {
        username: user.username,
        nickname: user.nickname
      }
    },
    200,
    origin
  );
}


async function handleLogout(
  request,
  env,
  origin
) {

  const token =
    getBearerToken(request);

  if (token) {

    await env.ZETA_USERS.delete(
      `session:${token}`
    );
  }


  return json(
    {
      success: true
    },
    200,
    origin
  );
}


// ============================================================
// ADMIN AUTH
// ============================================================

async function requireAdmin(
  request,
  env,
  origin
) {

  const session =
    await getCurrentUser(
      request,
      env
    );


  if (!session) {

    return {
      error: json(
        {
          error:
            "로그인이 필요합니다."
        },
        401,
        origin
      )
    };
  }


  if (
    session.user.username !==
    "admin"
  ) {

    return {
      error: json(
        {
          error:
            "관리자 권한이 없습니다."
        },
        403,
        origin
      )
    };
  }


  if (
    (session.user.status || "active") ===
    "suspended"
  ) {

    return {
      error: json(
        {
          error:
            "관리자 계정이 정지되었습니다."
        },
        403,
        origin
      )
    };
  }


  return {
    user: session.user
  };
}


// ============================================================
// ADMIN USERS
// ============================================================

async function handleAdminUsers(
  request,
  env,
  origin
) {

  const auth =
    await requireAdmin(
      request,
      env,
      origin
    );

  if (auth.error)
    return auth.error;


  const list =
    await env.ZETA_USERS.list({
      prefix: "user:",
      limit: 1000
    });


  const users = [];


  for (const key of list.keys) {

    const raw =
      await env.ZETA_USERS.get(
        key.name
      );

    if (!raw) continue;


    try {

      const user =
        JSON.parse(raw);


      users.push({
        username: user.username,
        nickname: user.nickname,
        status:
          user.status || "active",
        createdAt:
          user.createdAt || null
      });

    } catch {}
  }


  users.sort(
    (a, b) =>
      (b.createdAt || 0) -
      (a.createdAt || 0)
  );


  return json(
    { users },
    200,
    origin
  );
}


async function handleAdminUpdateUser(
  request,
  env,
  origin
) {

  const auth =
    await requireAdmin(
      request,
      env,
      origin
    );

  if (auth.error)
    return auth.error;


  const url =
    new URL(request.url);

  const username =
    String(
      url.searchParams.get(
        "username"
      ) || ""
    )
      .trim()
      .toLowerCase();


  if (!username) {

    return json(
      {
        error:
          "사용자가 지정되지 않았습니다."
      },
      400,
      origin
    );
  }


  const raw =
    await env.ZETA_USERS.get(
      `user:${username}`
    );


  if (!raw) {

    return json(
      {
        error:
          "사용자를 찾을 수 없습니다."
      },
      404,
      origin
    );
  }


  let user;

  try {
    user = JSON.parse(raw);
  } catch {
    return json(
      {
        error:
          "사용자 데이터가 손상되었습니다."
      },
      500,
      origin
    );
  }


  let body;

  try {
    body = await request.json();
  } catch {
    return json(
      {
        error:
          "잘못된 JSON 요청입니다."
      },
      400,
      origin
    );
  }


  // 관리자 자신은 정지 불가
  if (
    username === "admin" &&
    body.status === "suspended"
  ) {

    return json(
      {
        error:
          "관리자 계정은 정지할 수 없습니다."
      },
      400,
      origin
    );
  }


  if (
    body.status !== undefined
  ) {

    const status =
      String(body.status)
        .trim()
        .toLowerCase();


    if (
      !["active", "suspended"]
        .includes(status)
    ) {

      return json(
        {
          error:
            "잘못된 회원 상태입니다."
        },
        400,
        origin
      );
    }


    user.status =
      status;


    // 정지하면 모든 세션 제거
    if (
      status === "suspended"
    ) {

      const sessions =
        await env.ZETA_USERS.list({
          prefix: "session:",
          limit: 1000
        });


      for (
        const key of sessions.keys
      ) {

        const owner =
          await env.ZETA_USERS.get(
            key.name
          );


        if (
          owner === username
        ) {

          await env.ZETA_USERS.delete(
            key.name
          );
        }
      }
    }
  }


  if (
    body.nickname !== undefined
  ) {

    const nickname =
      String(body.nickname || "")
        .trim();


    if (!nickname) {

      return json(
        {
          error:
            "닉네임을 입력해주세요."
        },
        400,
        origin
      );
    }


    if (nickname.length > 20) {

      return json(
        {
          error:
            "닉네임은 20자 이하입니다."
        },
        400,
        origin
      );
    }


    user.nickname =
      nickname;
  }


  await env.ZETA_USERS.put(
    `user:${username}`,
    JSON.stringify(user)
  );


  return json(
    {
      success: true,

      user: {
        username:
          user.username,

        nickname:
          user.nickname,

        status:
          user.status || "active"
      }
    },
    200,
    origin
  );
}


// ============================================================
// ADMIN PASSWORD
// ============================================================

async function deleteUserSessions(
  env,
  username
) {

  const sessions =
    await env.ZETA_USERS.list({
      prefix: "session:",
      limit: 1000
    });


  for (
    const key of sessions.keys
  ) {

    const owner =
      await env.ZETA_USERS.get(
        key.name
      );


    if (owner === username) {

      await env.ZETA_USERS.delete(
        key.name
      );
    }
  }
}


async function handleAdminResetPassword(
  request,
  env,
  origin
) {

  const auth =
    await requireAdmin(
      request,
      env,
      origin
    );

  if (auth.error)
    return auth.error;


  const url =
    new URL(request.url);

  const username =
    String(
      url.searchParams.get(
        "username"
      ) || ""
    )
      .trim()
      .toLowerCase();


  const raw =
    await env.ZETA_USERS.get(
      `user:${username}`
    );


  if (!raw) {

    return json(
      {
        error:
          "사용자를 찾을 수 없습니다."
      },
      404,
      origin
    );
  }


  let body;

  try {
    body = await request.json();
  } catch {
    return json(
      {
        error:
          "잘못된 JSON 요청입니다."
      },
      400,
      origin
    );
  }


  const password =
    String(body.password || "");


  if (password.length < 6) {

    return json(
      {
        error:
          "비밀번호는 6자 이상이어야 합니다."
      },
      400,
      origin
    );
  }


  let user;

  try {
    user = JSON.parse(raw);
  } catch {
    return json(
      {
        error:
          "사용자 데이터가 손상되었습니다."
      },
      500,
      origin
    );
  }


  const salt =
    randomHex(16);


  user.salt =
    salt;

  user.passwordHash =
    await hashPassword(
      password,
      salt
    );


  await env.ZETA_USERS.put(
    `user:${username}`,
    JSON.stringify(user)
  );


  await deleteUserSessions(
    env,
    username
  );


  return json(
    {
      success: true
    },
    200,
    origin
  );
}


// ============================================================
// ADMIN DELETE USER
// ============================================================

async function handleAdminDeleteUser(
  request,
  env,
  origin
) {

  const auth =
    await requireAdmin(
      request,
      env,
      origin
    );

  if (auth.error)
    return auth.error;


  const url =
    new URL(request.url);

  const username =
    String(
      url.searchParams.get(
        "username"
      ) || ""
    )
      .trim()
      .toLowerCase();


  if (
    username === "admin"
  ) {

    return json(
      {
        error:
          "관리자 계정은 삭제할 수 없습니다."
      },
      400,
      origin
    );
  }


  const existing =
    await env.ZETA_USERS.get(
      `user:${username}`
    );


  if (!existing) {

    return json(
      {
        error:
          "사용자를 찾을 수 없습니다."
      },
      404,
      origin
    );
  }


  await deleteUserSessions(
    env,
    username
  );


  await env.ZETA_USERS.delete(
    `user:${username}`
  );


  return json(
    {
      success: true
    },
    200,
    origin
  );
}


// ============================================================
// CHARACTERS
// ============================================================

async function handleGetCharacters(
  env,
  origin
) {

  if (!env.ZETA_CHARACTERS) {

    return json(
      {
        error:
          "ZETA_CHARACTERS KV가 연결되지 않았습니다."
      },
      500,
      origin
    );
  }


  const list =
    await env.ZETA_CHARACTERS.list({
      prefix: "char:",
      limit: MAX_CHARACTERS_RETURNED
    });


  const characters = [];


  for (
    const key of list.keys
  ) {

    const raw =
      await env.ZETA_CHARACTERS.get(
        key.name
      );

    if (!raw) continue;


    try {

      const character =
        JSON.parse(raw);


      // 비공개 캐릭터는 일반 탐색에서 제외
      if (
        character.visibility ===
        "private"
      ) {
        continue;
      }


      characters.push(
        character
      );

    } catch {}
  }


  characters.sort(
    (a, b) =>
      (b.createdAt || 0) -
      (a.createdAt || 0)
  );


  return json(
    { characters },
    200,
    origin
  );
}


// ============================================================
// CREATE CHARACTER
// ============================================================

async function handlePostCharacter(
  request,
  env,
  origin
) {

  const session =
    await getCurrentUser(
      request,
      env
    );


  if (!session) {

    return json(
      {
        error:
          "로그인이 필요합니다."
      },
      401,
      origin
    );
  }


  if (
    (session.user.status || "active") ===
    "suspended"
  ) {

    return json(
      {
        error:
          "정지된 계정은 캐릭터를 만들 수 없습니다."
      },
      403,
      origin
    );
  }


  let body;

  try {
    body = await request.json();
  } catch {
    return json(
      {
        error:
          "잘못된 JSON 요청입니다."
      },
      400,
      origin
    );
  }


  const input =
    body.character || {};


  const name =
    sanitizeField(
      input.name
    );

  const personality =
    sanitizeField(
      input.personality
    );

  const scenario =
    sanitizeField(
      input.scenario
    );

  const firstMessage =
    sanitizeField(
      input.firstMessage
    );


  if (
    !name ||
    !personality ||
    !scenario ||
    !firstMessage
  ) {

    return json(
      {
        error:
          "캐릭터 이름, 성격, 시나리오, 첫 메시지는 필수입니다."
      },
      400,
      origin
    );
  }


  const category =
    sanitizeField(
      input.category,
      "판타지/SF"
    );


  const avatar =
    sanitizeField(
      input.avatar,
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
    );


  const tags =
    Array.isArray(input.tags)
      ? input.tags
          .map(
            x => sanitizeField(x)
          )
          .filter(Boolean)
          .slice(0, 10)
      : ["커스텀"];


  const visibility =
    input.visibility === "private"
      ? "private"
      : "public";


  const id =
    "online_" +
    Date.now() +
    "_" +
    randomHex(4);


  const character = {

    id,

    name,

    category,

    tags,

    avatar,

    visibility,

    creator:
      session.user.nickname ||
      session.user.username,

    creatorUsername:
      session.user.username,

    chatCount: "0",

    personality,

    scenario,

    firstMessage,

    createdAt:
      Date.now()
  };


  await env.ZETA_CHARACTERS.put(
    `char:${id}`,
    JSON.stringify(character)
  );


  return json(
    {
      character
    },
    201,
    origin
  );
}


// ============================================================
// MY CHARACTERS
// ============================================================

async function handleMyCharacters(
  request,
  env,
  origin
) {

  const session =
    await getCurrentUser(
      request,
      env
    );


  if (!session) {

    return json(
      {
        error:
          "로그인이 필요합니다."
      },
      401,
      origin
    );
  }


  const list =
    await env.ZETA_CHARACTERS.list({
      prefix: "char:",
      limit: MAX_CHARACTERS_RETURNED
    });


  const characters = [];


  for (
    const key of list.keys
  ) {

    const raw =
      await env.ZETA_CHARACTERS.get(
        key.name
      );

    if (!raw) continue;


    try {

      const character =
        JSON.parse(raw);


      if (
        character.creatorUsername ===
        session.user.username
      ) {

        characters.push(
          character
        );
      }

    } catch {}
  }


  characters.sort(
    (a, b) =>
      (b.createdAt || 0) -
      (a.createdAt || 0)
  );


  return json(
    {
      characters
    },
    200,
    origin
  );
}


// ============================================================
// EDIT CHARACTER
// ============================================================

async function handleUpdateCharacter(
  request,
  env,
  origin
) {

  const session =
    await getCurrentUser(
      request,
      env
    );


  if (!session) {

    return json(
      {
        error:
          "로그인이 필요합니다."
      },
      401,
      origin
    );
  }


  const url =
    new URL(request.url);

  const id =
    String(
      url.searchParams.get(
        "id"
      ) || ""
    ).trim();


  if (!id) {

    return json(
      {
        error:
          "캐릭터 ID가 없습니다."
      },
      400,
      origin
    );
  }


  const key =
    `char:${id}`;


  const raw =
    await env.ZETA_CHARACTERS.get(
      key
    );


  if (!raw) {

    return json(
      {
        error:
          "캐릭터를 찾을 수 없습니다."
      },
      404,
      origin
    );
  }


  let current;

  try {
    current = JSON.parse(raw);
  } catch {
    return json(
      {
        error:
          "캐릭터 데이터가 손상되었습니다."
      },
      500,
      origin
    );
  }


  if (
    current.creatorUsername !==
    session.user.username
  ) {

    return json(
      {
        error:
          "본인이 만든 캐릭터만 수정할 수 있습니다."
      },
      403,
      origin
    );
  }


  let body;

  try {
    body = await request.json();
  } catch {
    return json(
      {
        error:
          "잘못된 JSON 요청입니다."
      },
      400,
      origin
    );
  }


  const input =
    body.character || {};


  const name =
    sanitizeField(
      input.name,
      current.name
    );

  const category =
    sanitizeField(
      input.category,
      current.category
    );

  const avatar =
    sanitizeField(
      input.avatar,
      current.avatar
    );

  const personality =
    sanitizeField(
      input.personality,
      current.personality
    );

  const scenario =
    sanitizeField(
      input.scenario,
      current.scenario
    );

  const firstMessage =
    sanitizeField(
      input.firstMessage,
      current.firstMessage
    );


  if (
    !name ||
    !personality ||
    !scenario ||
    !firstMessage
  ) {

    return json(
      {
        error:
          "필수 캐릭터 정보가 비어 있습니다."
      },
      400,
      origin
    );
  }


  const tags =
    Array.isArray(input.tags)
      ? input.tags
          .map(x => sanitizeField(x))
          .filter(Boolean)
          .slice(0, 10)
      : current.tags || [];


  const visibility =
    input.visibility === "private"
      ? "private"
      : "public";


  const updated = {

    ...current,

    name,

    category,

    avatar,

    tags,

    visibility,

    personality,

    scenario,

    firstMessage,

    updatedAt:
      Date.now()
  };


  await env.ZETA_CHARACTERS.put(
    key,
    JSON.stringify(updated)
  );


  return json(
    {
      success: true,
      character: updated
    },
    200,
    origin
  );
}


// ============================================================
// DELETE CHARACTER
// ============================================================

async function handleDeleteCharacter(
  request,
  env,
  origin
) {

  const session =
    await getCurrentUser(
      request,
      env
    );


  if (!session) {

    return json(
      {
        error:
          "로그인이 필요합니다."
      },
      401,
      origin
    );
  }


  const url =
    new URL(request.url);

  const id =
    String(
      url.searchParams.get(
        "id"
      ) || ""
    ).trim();


  const key =
    `char:${id}`;


  const raw =
    await env.ZETA_CHARACTERS.get(
      key
    );


  if (!raw) {

    return json(
      {
        error:
          "캐릭터를 찾을 수 없습니다."
      },
      404,
      origin
    );
  }


  let character;

  try {
    character =
      JSON.parse(raw);
  } catch {
    return json(
      {
        error:
          "캐릭터 데이터가 손상되었습니다."
      },
      500,
      origin
    );
  }


  if (
    character.creatorUsername !==
    session.user.username &&
    session.user.username !== "admin"
  ) {

    return json(
      {
        error:
          "본인이 만든 캐릭터만 삭제할 수 있습니다."
      },
      403,
      origin
    );
  }


  await env.ZETA_CHARACTERS.delete(
    key
  );


  return json(
    {
      success: true
    },
    200,
    origin
  );
}


// ============================================================
// ADMIN CHARACTERS
// ============================================================

async function handleAdminCharacters(
  request,
  env,
  origin
) {

  const auth =
    await requireAdmin(
      request,
      env,
      origin
    );

  if (auth.error)
    return auth.error;


  const list =
    await env.ZETA_CHARACTERS.list({
      prefix: "char:",
      limit: MAX_CHARACTERS_RETURNED
    });


  const characters = [];


  for (
    const key of list.keys
  ) {

    const raw =
      await env.ZETA_CHARACTERS.get(
        key.name
      );

    if (!raw) continue;


    try {
      characters.push(
        JSON.parse(raw)
      );
    } catch {}
  }


  characters.sort(
    (a, b) =>
      (b.createdAt || 0) -
      (a.createdAt || 0)
  );


  return json(
    {
      characters
    },
    200,
    origin
  );
}


async function handleAdminUpdateCharacter(
  request,
  env,
  origin
) {

  const auth =
    await requireAdmin(
      request,
      env,
      origin
    );

  if (auth.error)
    return auth.error;


  const url =
    new URL(request.url);

  const id =
    String(
      url.searchParams.get(
        "id"
      ) || ""
    ).trim();


  const key =
    `char:${id}`;


  const raw =
    await env.ZETA_CHARACTERS.get(
      key
    );


  if (!raw) {

    return json(
      {
        error:
          "캐릭터를 찾을 수 없습니다."
      },
      404,
      origin
    );
  }


  let current;

  try {
    current =
      JSON.parse(raw);
  } catch {
    return json(
      {
        error:
          "캐릭터 데이터가 손상되었습니다."
      },
      500,
      origin
    );
  }


  let body;

  try {
    body =
      await request.json();
  } catch {
    return json(
      {
        error:
          "잘못된 JSON 요청입니다."
      },
      400,
      origin
    );
  }


  const input =
    body.character || {};


  const updated = {

    ...current,

    name:
      sanitizeField(
        input.name,
        current.name
      ),

    category:
      sanitizeField(
        input.category,
        current.category
      ),

    avatar:
      sanitizeField(
        input.avatar,
        current.avatar
      ),

    tags:
      Array.isArray(input.tags)
        ? input.tags
            .map(x => sanitizeField(x))
            .filter(Boolean)
            .slice(0, 10)
        : current.tags || [],

    personality:
      sanitizeField(
        input.personality,
        current.personality
      ),

    scenario:
      sanitizeField(
        input.scenario,
        current.scenario
      ),

    firstMessage:
      sanitizeField(
        input.firstMessage,
        current.firstMessage
      ),

    visibility:
      input.visibility === "private"
        ? "private"
        : "public",

    updatedAt:
      Date.now()
  };


  await env.ZETA_CHARACTERS.put(
    key,
    JSON.stringify(updated)
  );


  return json(
    {
      success: true,
      character: updated
    },
    200,
    origin
  );
}


async function handleAdminDeleteCharacter(
  request,
  env,
  origin
) {

  const auth =
    await requireAdmin(
      request,
      env,
      origin
    );

  if (auth.error)
    return auth.error;


  const url =
    new URL(request.url);

  const id =
    String(
      url.searchParams.get(
        "id"
      ) || ""
    ).trim();


  const key =
    `char:${id}`;


  const existing =
    await env.ZETA_CHARACTERS.get(
      key
    );


  if (!existing) {

    return json(
      {
        error:
          "캐릭터를 찾을 수 없습니다."
      },
      404,
      origin
    );
  }


  await env.ZETA_CHARACTERS.delete(
    key
  );


  return json(
    {
      success: true
    },
    200,
    origin
  );
}


// ============================================================
// CHAT HISTORY
// ============================================================

async function requireChatUser(
  request,
  env,
  origin
) {

  const session =
    await getCurrentUser(
      request,
      env
    );


  if (!session) {

    return {
      error: json(
        {
          error:
            "로그인이 필요합니다."
        },
        401,
        origin
      )
    };
  }


  if (
    (session.user.status || "active") ===
    "suspended"
  ) {

    return {
      error: json(
        {
          error:
            "정지된 계정입니다."
        },
        403,
        origin
      )
    };
  }


  return {
    user: session.user
  };
}


async function handleGetChat(
  request,
  env,
  origin
) {

  const auth =
    await requireChatUser(
      request,
      env,
      origin
    );

  if (auth.error)
    return auth.error;


  const url =
    new URL(request.url);

  const characterId =
    String(
      url.searchParams.get(
        "characterId"
      ) || ""
    ).trim();


  if (!characterId) {

    return json(
      {
        error:
          "characterId가 필요합니다."
      },
      400,
      origin
    );
  }


  const key =
    `chat:${auth.user.username}:${characterId}`;


  const raw =
    await env.ZETA_USERS.get(
      key
    );


  if (!raw) {

    return json(
      {
        messages: []
      },
      200,
      origin
    );
  }


  try {

    const messages =
      JSON.parse(raw);


    return json(
      {
        messages:
          Array.isArray(messages)
            ? messages
            : []
      },
      200,
      origin
    );

  } catch {

    return json(
      {
        messages: []
      },
      200,
      origin
    );
  }
}


async function handleSaveChat(
  request,
  env,
  origin
) {

  const auth =
    await requireChatUser(
      request,
      env,
      origin
    );

  if (auth.error)
    return auth.error;


  const url =
    new URL(request.url);

  const characterId =
    String(
      url.searchParams.get(
        "characterId"
      ) || ""
    ).trim();


  if (!characterId) {

    return json(
      {
        error:
          "characterId가 필요합니다."
      },
      400,
      origin
    );
  }


  let body;

  try {
    body =
      await request.json();
  } catch {
    return json(
      {
        error:
          "잘못된 JSON 요청입니다."
      },
      400,
      origin
    );
  }


  const messages =
    Array.isArray(body.messages)
      ? body.messages
          .slice(-MAX_CHAT_MESSAGES)
          .map(msg => ({
            sender:
              msg.sender === "user"
                ? "user"
                : "ai",

            text:
              String(
                msg.text || ""
              )
                .slice(
                  0,
                  MAX_HISTORY_TEXT_LENGTH
                ),

            timestamp:
              msg.timestamp ||
              new Date().toLocaleTimeString()
          }))
          .filter(
            msg => msg.text
          )
      : [];


  const key =
    `chat:${auth.user.username}:${characterId}`;


  await env.ZETA_USERS.put(
    key,
    JSON.stringify(messages)
  );


  return json(
    {
      success: true,
      messages
    },
    200,
    origin
  );
}


async function handleDeleteChat(
  request,
  env,
  origin
) {

  const auth =
    await requireChatUser(
      request,
      env,
      origin
    );

  if (auth.error)
    return auth.error;


  const url =
    new URL(request.url);

  const characterId =
    String(
      url.searchParams.get(
        "characterId"
      ) || ""
    ).trim();


  if (!characterId) {

    return json(
      {
        error:
          "characterId가 필요합니다."
      },
      400,
      origin
    );
  }


  await env.ZETA_USERS.delete(
    `chat:${auth.user.username}:${characterId}`
  );


  return json(
    {
      success: true
    },
    200,
    origin
  );
}


// ============================================================
// REPORTS
// ============================================================

async function handleCreateReport(
  request,
  env,
  origin
) {

  const auth =
    await requireChatUser(
      request,
      env,
      origin
    );

  if (auth.error)
    return auth.error;


  let body;

  try {
    body =
      await request.json();
  } catch {
    return json(
      {
        error:
          "잘못된 JSON 요청입니다."
      },
      400,
      origin
    );
  }


  const characterId =
    String(
      body.characterId || ""
    ).trim();


  const reason =
    String(
      body.reason || ""
    ).trim();


  const detail =
    String(
      body.detail || ""
    )
      .trim()
      .slice(
        0,
        MAX_REPORT_DETAIL
      );


  if (!characterId) {

    return json(
      {
        error:
          "신고할 캐릭터가 없습니다."
      },
      400,
      origin
    );
  }


  if (!reason) {

    return json(
      {
        error:
          "신고 사유를 선택해주세요."
      },
      400,
      origin
    );
  }


  const characterRaw =
    await env.ZETA_CHARACTERS.get(
      `char:${characterId}`
    );


  if (!characterRaw) {

    return json(
      {
        error:
          "캐릭터를 찾을 수 없습니다."
      },
      404,
      origin
    );
  }


  const reportId =
    "report_" +
    Date.now() +
    "_" +
    randomHex(4);


  const report = {

    id: reportId,

    characterId,

    reporterUsername:
      auth.user.username,

    reporterNickname:
      auth.user.nickname,

    reason,

    detail,

    status: "pending",

    createdAt:
      Date.now()
  };


  await env.ZETA_USERS.put(
    `report:${reportId}`,
    JSON.stringify(report)
  );


  return json(
    {
      success: true,
      report
    },
    201,
    origin
  );
}


async function handleAdminReports(
  request,
  env,
  origin
) {

  const auth =
    await requireAdmin(
      request,
      env,
      origin
    );

  if (auth.error)
    return auth.error;


  const list =
    await env.ZETA_USERS.list({
      prefix: "report:",
      limit: 1000
    });


  const reports = [];


  for (
    const key of list.keys
  ) {

    const raw =
      await env.ZETA_USERS.get(
        key.name
      );

    if (!raw) continue;


    try {

      reports.push(
        JSON.parse(raw)
      );

    } catch {}
  }


  reports.sort(
    (a, b) =>
      (b.createdAt || 0) -
      (a.createdAt || 0)
  );


  return json(
    {
      reports
    },
    200,
    origin
  );
}


async function handleAdminUpdateReport(
  request,
  env,
  origin
) {

  const auth =
    await requireAdmin(
      request,
      env,
      origin
    );

  if (auth.error)
    return auth.error;


  const url =
    new URL(request.url);

  const id =
    String(
      url.searchParams.get(
        "id"
      ) || ""
    ).trim();


  const raw =
    await env.ZETA_USERS.get(
      `report:${id}`
    );


  if (!raw) {

    return json(
      {
        error:
          "신고를 찾을 수 없습니다."
      },
      404,
      origin
    );
  }


  let report;

  try {
    report =
      JSON.parse(raw);
  } catch {
    return json(
      {
        error:
          "신고 데이터가 손상되었습니다."
      },
      500,
      origin
    );
  }


  let body;

  try {
    body =
      await request.json();
  } catch {
    return json(
      {
        error:
          "잘못된 JSON 요청입니다."
      },
      400,
      origin
    );
  }


  const allowed =
    [
      "pending",
      "reviewing",
      "resolved",
      "dismissed"
    ];


  if (
    body.status &&
    allowed.includes(
      body.status
    )
  ) {

    report.status =
      body.status;
  }


  report.updatedAt =
    Date.now();


  await env.ZETA_USERS.put(
    `report:${id}`,
    JSON.stringify(report)
  );


  return json(
    {
      success: true,
      report
    },
    200,
    origin
  );
}


// ============================================================
// ROUTER
// ============================================================

export default {

  async fetch(
    request,
    env
  ) {

    const origin =
      request.headers.get(
        "Origin"
      ) || "";


    if (
      request.method ===
      "OPTIONS"
    ) {

      return new Response(
        null,
        {
          status: 204,
          headers:
            corsHeaders(origin)
        }
      );
    }


    const url =
      new URL(request.url);


    try {


      // ----------------------------
      // AI
      // ----------------------------

      if (
        url.pathname === "/chat" &&
        request.method === "POST"
      ) {

        return await handleChat(
          request,
          env,
          origin
        );
      }


      // ----------------------------
      // AUTH
      // ----------------------------

      if (
        url.pathname === "/auth/signup" &&
        request.method === "POST"
      ) {

        return await handleSignup(
          request,
          env,
          origin
        );
      }


      if (
        url.pathname === "/auth/login" &&
        request.method === "POST"
      ) {

        return await handleLogin(
          request,
          env,
          origin
        );
      }


      if (
        url.pathname === "/auth/me" &&
        request.method === "GET"
      ) {

        return await handleMe(
          request,
          env,
          origin
        );
      }


      if (
        url.pathname === "/auth/logout" &&
        request.method === "POST"
      ) {

        return await handleLogout(
          request,
          env,
          origin
        );
      }


      // ----------------------------
      // CHARACTERS
      // ----------------------------

      if (
        url.pathname === "/characters" &&
        request.method === "GET"
      ) {

        return await handleGetCharacters(
          env,
          origin
        );
      }


      if (
        url.pathname === "/characters" &&
        request.method === "POST"
      ) {

        return await handlePostCharacter(
          request,
          env,
          origin
        );
      }


      if (
        url.pathname === "/characters/mine" &&
        request.method === "GET"
      ) {

        return await handleMyCharacters(
          request,
          env,
          origin
        );
      }


      if (
        url.pathname === "/characters" &&
        request.method === "PUT"
      ) {

        return await handleUpdateCharacter(
          request,
          env,
          origin
        );
      }


      if (
        url.pathname === "/characters" &&
        request.method === "DELETE"
      ) {

        return await handleDeleteCharacter(
          request,
          env,
          origin
        );
      }


      // ----------------------------
      // CHAT HISTORY
      // ----------------------------

      if (
        url.pathname === "/chats" &&
        request.method === "GET"
      ) {

        return await handleGetChat(
          request,
          env,
          origin
        );
      }


      if (
        url.pathname === "/chats" &&
        request.method === "POST"
      ) {

        return await handleSaveChat(
          request,
          env,
          origin
        );
      }


      if (
        url.pathname === "/chats" &&
        request.method === "DELETE"
      ) {

        return await handleDeleteChat(
          request,
          env,
          origin
        );
      }


      // ----------------------------
      // REPORT
      // ----------------------------

      if (
        url.pathname === "/reports" &&
        request.method === "POST"
      ) {

        return await handleCreateReport(
          request,
          env,
          origin
        );
      }


      // ----------------------------
      // ADMIN USERS
      // ----------------------------

      if (
        url.pathname === "/admin/users" &&
        request.method === "GET"
      ) {

        return await handleAdminUsers(
          request,
          env,
          origin
        );
      }


      if (
        url.pathname === "/admin/users" &&
        request.method === "PATCH"
      ) {

        return await handleAdminUpdateUser(
          request,
          env,
          origin
        );
      }


      if (
        url.pathname === "/admin/users/reset-password" &&
        request.method === "POST"
      ) {

        return await handleAdminResetPassword(
          request,
          env,
          origin
        );
      }


      if (
        url.pathname === "/admin/users" &&
        request.method === "DELETE"
      ) {

        return await handleAdminDeleteUser(
          request,
          env,
          origin
        );
      }


      // ----------------------------
      // ADMIN CHARACTERS
      // ----------------------------

      if (
        url.pathname === "/admin/characters" &&
        request.method === "GET"
      ) {

        return await handleAdminCharacters(
          request,
          env,
          origin
        );
      }


      if (
        url.pathname === "/admin/characters" &&
        request.method === "PUT"
      ) {

        return await handleAdminUpdateCharacter(
          request,
          env,
          origin
        );
      }


      if (
        url.pathname === "/admin/characters" &&
        request.method === "DELETE"
      ) {

        return await handleAdminDeleteCharacter(
          request,
          env,
          origin
        );
      }


      // ----------------------------
      // ADMIN REPORTS
      // ----------------------------

      if (
        url.pathname === "/admin/reports" &&
        request.method === "GET"
      ) {

        return await handleAdminReports(
          request,
          env,
          origin
        );
      }


      if (
        url.pathname === "/admin/reports" &&
        request.method === "PATCH"
      ) {

        return await handleAdminUpdateReport(
          request,
          env,
          origin
        );
      }


      // ----------------------------
      // NOT FOUND
      // ----------------------------

      return json(
        {
          error:
            "Not Found"
        },
        404,
        origin
      );


    } catch (error) {

      console.error(
        "ZETA Worker error:",
        error
      );


      return json(
        {
          error:
            error?.message ||
            "서버 오류가 발생했습니다."
        },
        500,
        origin
      );
    }
  }
};