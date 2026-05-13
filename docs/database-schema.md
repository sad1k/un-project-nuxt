# 📊 Database Schema — WanderLog

## ER Diagram

```mermaid
erDiagram
    user ||--o{ session : "has"
    user ||--o{ account : "has"
    user ||--o{ location : "owns"
    user ||--o{ locationLog : "creates"
    user ||--o{ locationLogImage : "uploads"
    user ||--o{ post : "publishes"
    user ||--o{ postLike : "likes"
    user ||--o{ postComment : "writes"

    location ||--o{ locationLog : "contains"
    locationLog ||--o{ locationLogImage : "has"
    locationLogImage ||--o| post : "shared as"
    post ||--o{ postLike : "receives"
    post ||--o{ postComment : "has"
    postComment ||--o| postComment : "replies to"

    user {
        int id PK
        text name
        text email UK
        boolean emailVerified
        text image
        int createdAt
        int updatedAt
    }

    session {
        int id PK
        int expiresAt
        text token UK
        int createdAt
        int updatedAt
        text ipAddress
        text userAgent
        int userId FK
    }

    account {
        int id PK
        text accountId
        text providerId
        int userId FK
        text accessToken
        text refreshToken
        text idToken
        int accessTokenExpiresAt
        int refreshTokenExpiresAt
        text scope
        text password
        int createdAt
        int updatedAt
    }

    verification {
        int id PK
        text identifier
        text value
        int expiresAt
        int createdAt
        int updatedAt
    }

    location {
        int id PK
        text name
        text slug UK
        text description
        real lat
        real long
        int userId FK
        int createdAt
        int updateAt
    }

    locationLog {
        int id PK
        text name
        text description
        int startedAt
        int endedAt
        real lat
        real long
        int userId FK
        int locationId FK
        int createdAt
        int updateAt
    }

    locationLogImage {
        int id PK
        text key
        text description
        int locationLogId FK
        int userId FK
        int createdAt
        int updateAt
    }

    post {
        int id PK
        int locationLogImageId UK
        int userId FK
        text caption
        int createdAt
        int updatedAt
    }

    postLike {
        int id PK
        int postId FK
        int userId FK
        int createdAt
    }

    postComment {
        int id PK
        int postId FK
        int userId FK
        text content
        int parentId
        int replyToUserId
        int createdAt
        int updatedAt
    }
```

---

## 📋 Таблицы по областям

### 🔐 Auth (Better Auth)

| Таблица        | Описание                        |
| -------------- | ------------------------------- |
| `user`         | Пользователи системы            |
| `session`      | Активные сессии                 |
| `account`      | OAuth аккаунты (GitHub, Google) |
| `verification` | Токены подтверждения            |

### 📍 Locations (Места путешествий)

| Таблица            | Описание                          |
| ------------------ | --------------------------------- |
| `location`         | Основные места (города, страны)   |
| `locationLog`      | Записи о посещениях с датами      |
| `locationLogImage` | Фотографии, привязанные к записям |

### 📱 Social (Социальная лента)

| Таблица       | Описание                     |
| ------------- | ---------------------------- |
| `post`        | Публикации в ленте (из фото) |
| `postLike`    | Лайки к постам               |
| `postComment` | Комментарии с ответами       |

---

## 🔗 Ключевые связи

| Связь                              | Тип  | Описание              | ON DELETE |
| ---------------------------------- | ---- | --------------------- | --------- |
| `user` → `session`                 | 1:N  | Сессии пользователя   | CASCADE   |
| `user` → `account`                 | 1:N  | OAuth аккаунты        | CASCADE   |
| `user` → `location`                | 1:N  | Места пользователя    | CASCADE   |
| `location` → `locationLog`         | 1:N  | Записи в месте        | CASCADE   |
| `locationLog` → `locationLogImage` | 1:N  | Фото в записи         | CASCADE   |
| `locationLogImage` → `post`        | 1:1  | Публикация фото       | CASCADE   |
| `post` → `postLike`                | 1:N  | Лайки                 | CASCADE   |
| `post` → `postComment`             | 1:N  | Комментарии           | CASCADE   |
| `postComment` → `postComment`      | self | Ответы на комментарии | -         |

---

## ⚠️ Уникальные ограничения

| Таблица    | Constraint                    | Поля                 |
| ---------- | ----------------------------- | -------------------- |
| `user`     | `user_email_unique`           | `email`              |
| `session`  | `session_token_unique`        | `token`              |
| `location` | `location_slug_unique`        | `slug`               |
| `location` | `location_name_userId_unique` | `name`, `userId`     |
| `post`     | unique                        | `locationLogImageId` |
| `postLike` | unique                        | `postId`, `userId`   |
