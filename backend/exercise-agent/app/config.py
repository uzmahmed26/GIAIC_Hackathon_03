from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    database_url: str = "postgresql://learnflow:password@localhost:5432/learnflow"
    dapr_http_port: int = 3500
    pubsub_name: str = "pubsub"
    service_port: int = 8004
    log_level: str = "INFO"

    @property
    def dapr_base_url(self) -> str:
        return f"http://localhost:{self.dapr_http_port}"


settings = Settings()
