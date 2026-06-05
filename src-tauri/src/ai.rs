use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;

/// 本期仅 Anthropic;加 provider = 加 enum 分支 + match 分支。
/// lowercase 序列化 → "anthropic"，与前端 settings.aiProvider + keychain account 一致。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum AiProvider {
    Anthropic,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct AiCompleteRequest {
    pub provider: AiProvider,
    pub model: String,
    pub system: String,
    pub user: String,
    pub json_schema: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct AiCompleteResponse {
    pub text: Option<String>,
    pub json: Option<Value>,
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
            return Ok(AiCompleteResponse { text: None, json: Some(input) });
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
        assert_eq!(r.json, Some(json!({ "x": 1 })));
        assert!(r.text.is_none());
    }

    #[test]
    fn parse_missing_content_errors() {
        assert!(matches!(
            parse_anthropic_response(&json!({})).unwrap_err(),
            AiError::Parse(_)
        ));
    }
}
