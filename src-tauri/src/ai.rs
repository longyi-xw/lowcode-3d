use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;

/// 本期仅 Anthropic;加 provider = 加 enum 分支 + match 分支。
/// lowercase 序列化 → "anthropic"，与前端 settings.aiProvider + keychain account 一致。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum AiProvider {
    Anthropic,
    /// OpenAI-compatible chat/completions (https://api.deepseek.com).
    Deepseek,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct AiCompleteRequest {
    pub provider: AiProvider,
    pub model: String,
    pub system: String,
    pub user: String,
    /// JSON Schema as a string (frontend JSON.stringify). `serde_json::Value`
    /// can't be exported to TS by specta, so JSON crosses the IPC boundary as
    /// a string — same rationale as base64-for-bytes in assets.rs.
    pub json_schema: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct AiCompleteResponse {
    pub text: Option<String>,
    /// Structured output as a JSON string (frontend JSON.parse).
    pub json: Option<String>,
}

/// 与 FolderError 同款 specta 形状: { code, data? }。
#[derive(Debug, Serialize, Deserialize, Type)]
#[serde(tag = "code", content = "data", rename_all = "snake_case")]
pub enum AiError {
    NoKey,
    Network(String),
    ApiError { status: u16, message: String },
    Parse(String),
    Keychain(String),
}

const ANTHROPIC_VERSION: &str = "2023-06-01";
const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1/messages";
const DEEPSEEK_URL: &str = "https://api.deepseek.com";
const TOOL_NAME: &str = "emit_result";
const MAX_TOKENS: u32 = 1024;

/// 组 Anthropic Messages 请求体。有 schema → 加单个强制 tool（结构化输出）。
pub fn build_anthropic_body(
    model: &str,
    system: &str,
    user: &str,
    schema: Option<&Value>,
) -> Value {
    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": MAX_TOKENS,
        "system": system,
        "messages": [{ "role": "user", "content": user }],
    });
    if let Some(schema) = schema {
        body["tools"] = serde_json::json!([{
            "name": TOOL_NAME,
            "description": "Return the result as structured data.",
            "input_schema": schema,
        }]);
        body["tool_choice"] = serde_json::json!({ "type": "tool", "name": TOOL_NAME });
    }
    body
}

/// 解析 Anthropic 响应:优先 tool_use block 的 input(结构化),否则拼 text block。
pub fn parse_anthropic_response(body: &Value) -> Result<AiCompleteResponse, AiError> {
    let content = body
        .get("content")
        .and_then(|c| c.as_array())
        .ok_or_else(|| AiError::Parse("missing content array".into()))?;

    for block in content {
        if block.get("type").and_then(|t| t.as_str()) == Some("tool_use") {
            let input = block
                .get("input")
                .cloned()
                .ok_or_else(|| AiError::Parse("tool_use without input".into()))?;
            return Ok(AiCompleteResponse { text: None, json: Some(input.to_string()) });
        }
    }

    let mut text = String::new();
    for block in content {
        if block.get("type").and_then(|t| t.as_str()) == Some("text") {
            if let Some(t) = block.get("text").and_then(|t| t.as_str()) {
                text.push_str(t);
            }
        }
    }
    if text.is_empty() {
        return Err(AiError::Parse("no text or tool_use blocks".into()));
    }
    Ok(AiCompleteResponse { text: Some(text), json: None })
}

/// 组 OpenAI 兼容 chat/completions 请求体(DeepSeek 用)。有 schema → function
/// calling 强制结构化(tools + tool_choice)。
pub fn build_openai_body(model: &str, system: &str, user: &str, schema: Option<&Value>) -> Value {
    let mut body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user },
        ],
    });
    if let Some(schema) = schema {
        body["tools"] = serde_json::json!([{
            "type": "function",
            "function": {
                "name": TOOL_NAME,
                "description": "Return the result as structured data.",
                "parameters": schema,
            },
        }]);
        body["tool_choice"] = serde_json::json!({
            "type": "function",
            "function": { "name": TOOL_NAME },
        });
    }
    body
}

/// 解析 OpenAI 兼容响应:优先 tool_calls[0].function.arguments(已是 JSON 字符串),
/// 否则 message.content → text。
pub fn parse_openai_response(body: &Value) -> Result<AiCompleteResponse, AiError> {
    let message = body
        .get("choices")
        .and_then(|c| c.as_array())
        .and_then(|a| a.first())
        .and_then(|c| c.get("message"))
        .ok_or_else(|| AiError::Parse("missing choices[0].message".into()))?;

    if let Some(first) = message
        .get("tool_calls")
        .and_then(|t| t.as_array())
        .and_then(|a| a.first())
    {
        let args = first
            .get("function")
            .and_then(|f| f.get("arguments"))
            .and_then(|a| a.as_str())
            .ok_or_else(|| AiError::Parse("tool_call without arguments".into()))?;
        return Ok(AiCompleteResponse { text: None, json: Some(args.to_string()) });
    }

    let content = message
        .get("content")
        .and_then(|c| c.as_str())
        .ok_or_else(|| AiError::Parse("message without content".into()))?;
    Ok(AiCompleteResponse { text: Some(content.to_string()), json: None })
}

use keyring::{Entry, Error as KeyringError};

const KEYCHAIN_SERVICE: &str = "lowcode3d-ai";

fn provider_account(p: AiProvider) -> &'static str {
    match p {
        AiProvider::Anthropic => "anthropic",
        AiProvider::Deepseek => "deepseek",
    }
}

fn key_entry(p: AiProvider) -> Result<Entry, AiError> {
    Entry::new(KEYCHAIN_SERVICE, provider_account(p))
        .map_err(|e| AiError::Keychain(e.to_string()))
}

#[tauri::command]
#[specta::specta]
pub fn set_ai_key(provider: AiProvider, key: String) -> Result<(), AiError> {
    key_entry(provider)?
        .set_password(&key)
        .map_err(|e| AiError::Keychain(e.to_string()))
}

#[tauri::command]
#[specta::specta]
pub fn has_ai_key(provider: AiProvider) -> Result<bool, AiError> {
    match key_entry(provider)?.get_password() {
        Ok(_) => Ok(true),
        Err(KeyringError::NoEntry) => Ok(false),
        Err(e) => Err(AiError::Keychain(e.to_string())),
    }
}

#[tauri::command]
#[specta::specta]
pub fn clear_ai_key(provider: AiProvider) -> Result<(), AiError> {
    match key_entry(provider)?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(e) => Err(AiError::Keychain(e.to_string())),
    }
}

async fn anthropic_complete(
    key: &str,
    req: &AiCompleteRequest,
) -> Result<AiCompleteResponse, AiError> {
    let schema: Option<Value> = match &req.json_schema {
        Some(s) => Some(serde_json::from_str(s).map_err(|e| AiError::Parse(e.to_string()))?),
        None => None,
    };
    let body = build_anthropic_body(&req.model, &req.system, &req.user, schema.as_ref());
    let resp = reqwest::Client::new()
        .post(ANTHROPIC_URL)
        .header("x-api-key", key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .json(&body)
        .send()
        .await
        .map_err(|e| AiError::Network(e.to_string()))?;
    let status = resp.status();
    let val: Value = resp
        .json()
        .await
        .map_err(|e| AiError::Parse(e.to_string()))?;
    if !status.is_success() {
        let message = val["error"]["message"]
            .as_str()
            .unwrap_or("unknown error")
            .to_string();
        return Err(AiError::ApiError { status: status.as_u16(), message });
    }
    parse_anthropic_response(&val)
}

/// OpenAI-compatible chat/completions (DeepSeek). `base_url` has no trailing
/// slash; the path `/chat/completions` is appended. Auth via Bearer token.
async fn openai_complete(
    key: &str,
    base_url: &str,
    req: &AiCompleteRequest,
) -> Result<AiCompleteResponse, AiError> {
    let schema: Option<Value> = match &req.json_schema {
        Some(s) => Some(serde_json::from_str(s).map_err(|e| AiError::Parse(e.to_string()))?),
        None => None,
    };
    let body = build_openai_body(&req.model, &req.system, &req.user, schema.as_ref());
    let resp = reqwest::Client::new()
        .post(format!("{base_url}/chat/completions"))
        .header("authorization", format!("Bearer {key}"))
        .json(&body)
        .send()
        .await
        .map_err(|e| AiError::Network(e.to_string()))?;
    let status = resp.status();
    let val: Value = resp
        .json()
        .await
        .map_err(|e| AiError::Parse(e.to_string()))?;
    if !status.is_success() {
        let message = val["error"]["message"]
            .as_str()
            .unwrap_or("unknown error")
            .to_string();
        return Err(AiError::ApiError { status: status.as_u16(), message });
    }
    parse_openai_response(&val)
}

#[tauri::command]
#[specta::specta]
pub async fn ai_complete(req: AiCompleteRequest) -> Result<AiCompleteResponse, AiError> {
    let key = match key_entry(req.provider)?.get_password() {
        Ok(k) => k,
        Err(KeyringError::NoEntry) => return Err(AiError::NoKey),
        Err(e) => return Err(AiError::Keychain(e.to_string())),
    };
    match req.provider {
        AiProvider::Anthropic => anthropic_complete(&key, &req).await,
        AiProvider::Deepseek => openai_complete(&key, DEEPSEEK_URL, &req).await,
    }
}

#[tauri::command]
#[specta::specta]
pub async fn test_ai_provider(provider: AiProvider, model: String) -> Result<(), AiError> {
    let req = AiCompleteRequest {
        provider,
        model,
        system: String::new(),
        user: "ping".into(),
        json_schema: None,
    };
    ai_complete(req).await.map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn body_without_schema_has_messages_no_tools() {
        let b = build_anthropic_body("m", "sys", "hi", None);
        assert_eq!(b["model"], "m");
        assert_eq!(b["system"], "sys");
        assert_eq!(b["messages"][0]["role"], "user");
        assert_eq!(b["messages"][0]["content"], "hi");
        assert!(b.get("tools").is_none());
    }

    #[test]
    fn body_with_schema_forces_tool_use() {
        let schema = json!({ "type": "object" });
        let b = build_anthropic_body("m", "", "", Some(&schema));
        assert_eq!(b["tools"][0]["name"], "emit_result");
        assert_eq!(b["tools"][0]["input_schema"], schema);
        assert_eq!(b["tool_choice"]["type"], "tool");
        assert_eq!(b["tool_choice"]["name"], "emit_result");
    }

    #[test]
    fn parse_text_response() {
        let r = parse_anthropic_response(&json!({
            "content": [{ "type": "text", "text": "hello" }]
        }))
        .unwrap();
        assert_eq!(r.text.as_deref(), Some("hello"));
        assert!(r.json.is_none());
    }

    #[test]
    fn parse_tool_use_response() {
        let r = parse_anthropic_response(&json!({
            "content": [{ "type": "tool_use", "name": "emit_result", "input": { "x": 1 } }]
        }))
        .unwrap();
        // json is a JSON string now — parse it back to compare structurally.
        let parsed: Value = serde_json::from_str(r.json.as_ref().unwrap()).unwrap();
        assert_eq!(parsed, json!({ "x": 1 }));
        assert!(r.text.is_none());
    }

    #[test]
    fn parse_missing_content_errors() {
        assert!(matches!(
            parse_anthropic_response(&json!({})).unwrap_err(),
            AiError::Parse(_)
        ));
    }

    #[test]
    fn openai_body_without_schema() {
        let b = build_openai_body("deepseek-chat", "sys", "hi", None);
        assert_eq!(b["model"], "deepseek-chat");
        assert_eq!(b["messages"][0]["role"], "system");
        assert_eq!(b["messages"][0]["content"], "sys");
        assert_eq!(b["messages"][1]["role"], "user");
        assert_eq!(b["messages"][1]["content"], "hi");
        assert!(b.get("tools").is_none());
    }

    #[test]
    fn openai_body_with_schema_forces_function() {
        let schema = json!({ "type": "object" });
        let b = build_openai_body("m", "", "u", Some(&schema));
        assert_eq!(b["tools"][0]["type"], "function");
        assert_eq!(b["tools"][0]["function"]["name"], "emit_result");
        assert_eq!(b["tools"][0]["function"]["parameters"], schema);
        assert_eq!(b["tool_choice"]["type"], "function");
        assert_eq!(b["tool_choice"]["function"]["name"], "emit_result");
    }

    #[test]
    fn parse_openai_text() {
        let r = parse_openai_response(&json!({
            "choices": [{ "message": { "role": "assistant", "content": "hello" } }]
        }))
        .unwrap();
        assert_eq!(r.text.as_deref(), Some("hello"));
        assert!(r.json.is_none());
    }

    #[test]
    fn parse_openai_tool_call() {
        let r = parse_openai_response(&json!({
            "choices": [{ "message": { "tool_calls": [
                { "function": { "name": "emit_result", "arguments": "{\"x\":1}" } }
            ] } }]
        }))
        .unwrap();
        let parsed: Value = serde_json::from_str(r.json.as_ref().unwrap()).unwrap();
        assert_eq!(parsed, json!({ "x": 1 }));
        assert!(r.text.is_none());
    }

    #[test]
    fn parse_openai_missing_choices_errors() {
        assert!(matches!(
            parse_openai_response(&json!({})).unwrap_err(),
            AiError::Parse(_)
        ));
    }
}
