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
