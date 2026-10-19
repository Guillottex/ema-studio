-- EMA Studio — esquema inicial
-- PostgreSQL 14+

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE roles (
  id          SERIAL PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,           -- admin | author | viewer
  label       TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role_id       INTEGER NOT NULL REFERENCES roles(id),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  preferences   JSONB NOT NULL DEFAULT '{}',
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  description TEXT,
  color       TEXT NOT NULL DEFAULT '#2563eb',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE themes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT UNIQUE,
  name       TEXT NOT NULL,
  data       JSONB NOT NULL,
  is_preset  BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE courses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  author       TEXT NOT NULL DEFAULT '',
  category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  cover_image  TEXT,
  duration     TEXT NOT NULL DEFAULT '',
  level        TEXT NOT NULL DEFAULT 'Básico',
  language     TEXT NOT NULL DEFAULT 'es',
  version      TEXT NOT NULL DEFAULT '1.0',
  objectives   JSONB NOT NULL DEFAULT '[]',
  requirements JSONB NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  theme_id     UUID REFERENCES themes(id) ON DELETE SET NULL,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX courses_status_idx ON courses(status);
CREATE INDEX courses_updated_idx ON courses(updated_at DESC);

-- Configuración del curso (tema resuelto, navegación, finalización, reanudación, logo)
CREATE TABLE course_settings (
  course_id UUID PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  settings  JSONB NOT NULL
);

CREATE TABLE modules (
  id          TEXT PRIMARY KEY,
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX modules_course_idx ON modules(course_id, position);

CREATE TABLE lessons (
  id          TEXT PRIMARY KEY,
  module_id   TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX lessons_module_idx ON lessons(module_id, position);

CREATE TABLE screens (
  id          TEXT PRIMARY KEY,
  lesson_id   TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  layout      TEXT,
  height      INTEGER NOT NULL DEFAULT 675,
  background  JSONB NOT NULL DEFAULT '{}',
  settings    JSONB NOT NULL DEFAULT '{}',
  tablet_mode TEXT NOT NULL DEFAULT 'auto',
  mobile_mode TEXT NOT NULL DEFAULT 'auto',
  position    INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX screens_lesson_idx ON screens(lesson_id, position);

-- Componentes: el tipo es texto libre y las propiedades JSONB, por lo que
-- agregar nuevos tipos de componentes no requiere cambios de esquema.
CREATE TABLE screen_components (
  screen_id  TEXT NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  id         TEXT NOT NULL,
  type       TEXT NOT NULL,
  name       TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  props      JSONB NOT NULL DEFAULT '{}',
  style      JSONB NOT NULL DEFAULT '{}',
  layout     JSONB NOT NULL,
  animation  JSONB,
  events     JSONB NOT NULL DEFAULT '[]',
  visibility JSONB NOT NULL DEFAULT '{}',
  locked     BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (screen_id, id)
);
CREATE INDEX screen_components_type_idx ON screen_components(type);

CREATE TABLE layouts (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  thumbnail   TEXT NOT NULL DEFAULT '',
  data        JSONB NOT NULL DEFAULT '{}',
  is_system   BOOLEAN NOT NULL DEFAULT TRUE,
  sort        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT NOT NULL CHECK (kind IN ('screen', 'course')),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT '',
  thumbnail   TEXT,
  data        JSONB NOT NULL,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX templates_kind_idx ON templates(kind);

CREATE TABLE media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  stored_name TEXT UNIQUE NOT NULL,         -- clave usada en el curso como "asset:<stored_name>"
  mime        TEXT NOT NULL,
  kind        TEXT NOT NULL,                -- image | video | audio | pdf
  size        BIGINT NOT NULL,
  width       INTEGER,
  height      INTEGER,
  thumb_name  TEXT,
  checksum    TEXT NOT NULL,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX media_checksum_idx ON media(checksum);

CREATE TABLE questions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type               TEXT NOT NULL,
  prompt             TEXT NOT NULL,
  category_id        INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  points             NUMERIC NOT NULL DEFAULT 1,
  feedback_correct   TEXT NOT NULL DEFAULT '',
  feedback_incorrect TEXT NOT NULL DEFAULT '',
  explanation        TEXT NOT NULL DEFAULT '',
  attempts           INTEGER NOT NULL DEFAULT 1,
  shuffle            BOOLEAN NOT NULL DEFAULT TRUE,
  time_limit         INTEGER NOT NULL DEFAULT 0,
  media              JSONB,
  extra              JSONB NOT NULL DEFAULT '{}',  -- fillText, acceptedAnswers, caseSensitive, partialCredit
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE question_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_key  TEXT NOT NULL,
  text        TEXT NOT NULL,
  is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
  match_text  TEXT,
  feedback    TEXT,
  position    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX question_options_q_idx ON question_options(question_id, position);

CREATE TABLE quizzes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  settings    JSONB NOT NULL DEFAULT '{}',
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quiz_questions (
  quiz_id     UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (quiz_id, question_id)
);

CREATE TABLE course_versions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  version    TEXT NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  snapshot   JSONB NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX course_versions_course_idx ON course_versions(course_id, created_at DESC);

CREATE TABLE scorm_exports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  version     TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  size        BIGINT NOT NULL DEFAULT 0,
  report      JSONB NOT NULL DEFAULT '{}',
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX scorm_exports_course_idx ON scorm_exports(course_id, created_at DESC);

CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
