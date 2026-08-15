-- ============================================================================
-- Ponto SaaS — schema completo do banco de dados (PostgreSQL 14+)
-- ============================================================================
-- Gerado a partir das migrations reais do projeto (pg_dump --schema-only),
-- ja rodadas e validadas localmente - nao foi escrito a mao em paralelo às
-- migrations, entao nao ha risco de os dois ficarem dessincronizados.
--
-- COMO USAR (duas opcoes — escolha UMA, nao as duas):
--
--   Opcao A — importar este arquivo direto (psql, pgAdmin, DBeaver, etc):
--     createdb ponto_saas
--     psql -U seu_usuario -d ponto_saas -f schema.sql
--     -> depois disso, NAO rode "npm run migrate" nesse mesmo banco.
--
--   Opcao B — usar o Knex (recomendado se for continuar desenvolvendo):
--     cd backend && npm install && npm run migrate && npm run seed
--     -> ignore este arquivo; ele so existe para inspecao/import direto.
--
-- Inclui: 21 tabelas (empresa/funcionario, escola/aluno e responsavel/push
-- token no mesmo banco), 17 enums, 18 CHECK constraints de sanidade de dados
-- e 17 triggers que mantem "updated_at" correto automaticamente.
-- ============================================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: apontamento_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.apontamento_status AS ENUM (
    'pendente',
    'aprovado',
    'ajustado'
);


--
-- Name: banco_horas_lancamento_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.banco_horas_lancamento_tipo AS ENUM (
    'credito',
    'debito',
    'ajuste_manual',
    'pagamento',
    'expiracao'
);


--
-- Name: banco_horas_tipo_acordo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.banco_horas_tipo_acordo AS ENUM (
    'nenhum',
    'tacito_mensal',
    'individual_escrito',
    'coletivo'
);


--
-- Name: dispositivo_modo_conexao; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.dispositivo_modo_conexao AS ENUM (
    'client',
    'server'
);


--
-- Name: dispositivo_protocolo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.dispositivo_protocolo AS ENUM (
    'zk_tcp',
    'http_rest',
    'desconhecido'
);


--
-- Name: dispositivo_situacao; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.dispositivo_situacao AS ENUM (
    'ativo',
    'inativo'
);


--
-- Name: dispositivo_tipo_biometria; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.dispositivo_tipo_biometria AS ENUM (
    'facial',
    'digital',
    'cartao',
    'senha',
    'misto'
);


--
-- Name: feriado_abrangencia; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.feriado_abrangencia AS ENUM (
    'nacional',
    'estadual',
    'municipal',
    'ponto_facultativo'
);


--
-- Name: filial_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.filial_tipo AS ENUM (
    'empresa',
    'escola'
);


--
-- Name: horario_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.horario_tipo AS ENUM (
    'fixo_semanal',
    'escala_12x36',
    'flexivel'
);


--
-- Name: justificativa_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.justificativa_status AS ENUM (
    'pendente',
    'aprovado',
    'recusado'
);


--
-- Name: justificativa_tipo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.justificativa_tipo AS ENUM (
    'atestado_medico',
    'falta_justificada',
    'ferias',
    'licenca',
    'folga_compensatoria',
    'outro'
);


--
-- Name: push_token_plataforma; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.push_token_plataforma AS ENUM (
    'ios',
    'android'
);


--
-- Name: registro_origem; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.registro_origem AS ENUM (
    'dispositivo',
    'manual',
    'app',
    'importacao'
);


--
-- Name: registro_tipo_batida; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.registro_tipo_batida AS ENUM (
    'entrada',
    'saida',
    'entrada_intervalo',
    'saida_intervalo',
    'indefinido'
);


--
-- Name: turma_turno; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.turma_turno AS ENUM (
    'manha',
    'tarde',
    'integral',
    'noite'
);


--
-- Name: usuario_papel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.usuario_papel AS ENUM (
    'super_admin',
    'admin',
    'rh',
    'gestor'
);


--
-- Name: definir_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.definir_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: afd_exports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.afd_exports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    periodo_inicio date NOT NULL,
    periodo_fim date NOT NULL,
    nsr_inicial bigint,
    nsr_final bigint,
    quantidade_registros integer DEFAULT 0 NOT NULL,
    arquivo_path character varying(300) NOT NULL,
    gerado_por uuid,
    gerado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: aluno_dispositivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aluno_dispositivos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aluno_id uuid NOT NULL,
    dispositivo_id uuid NOT NULL,
    id_no_dispositivo character varying(40) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: alunos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alunos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    filial_id uuid NOT NULL,
    turma_id uuid,
    matricula character varying(30) NOT NULL,
    nome character varying(150) NOT NULL,
    data_nascimento date,
    nome_responsavel character varying(150),
    contato_responsavel character varying(100),
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: apontamentos_diarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apontamentos_diarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    funcionario_id uuid NOT NULL,
    data date NOT NULL,
    batidas jsonb DEFAULT '[]'::jsonb NOT NULL,
    horas_previstas_minutos integer DEFAULT 0 NOT NULL,
    horas_trabalhadas_minutos integer DEFAULT 0 NOT NULL,
    saldo_minutos integer DEFAULT 0 NOT NULL,
    extras_50_minutos integer DEFAULT 0 NOT NULL,
    extras_100_minutos integer DEFAULT 0 NOT NULL,
    adicional_noturno_minutos integer DEFAULT 0 NOT NULL,
    atraso_minutos integer DEFAULT 0 NOT NULL,
    falta boolean DEFAULT false NOT NULL,
    feriado boolean DEFAULT false NOT NULL,
    justificativa_id uuid,
    status public.apontamento_status DEFAULT 'pendente'::public.apontamento_status NOT NULL,
    observacao text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_apontamentos_atraso_positivo CHECK ((atraso_minutos >= 0)),
    CONSTRAINT chk_apontamentos_extras100_positivo CHECK ((extras_100_minutos >= 0)),
    CONSTRAINT chk_apontamentos_extras50_positivo CHECK ((extras_50_minutos >= 0)),
    CONSTRAINT chk_apontamentos_noturno_positivo CHECK ((adicional_noturno_minutos >= 0)),
    CONSTRAINT chk_apontamentos_previstas_positivo CHECK ((horas_previstas_minutos >= 0)),
    CONSTRAINT chk_apontamentos_trabalhadas_positivo CHECK ((horas_trabalhadas_minutos >= 0))
);


--
-- Name: auditoria_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_logs (
    id bigint NOT NULL,
    empresa_id uuid,
    usuario_id uuid,
    acao character varying(60) NOT NULL,
    entidade character varying(60) NOT NULL,
    entidade_id character varying(60),
    dados_antes jsonb,
    dados_depois jsonb,
    ip_origem character varying(45),
    criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: auditoria_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auditoria_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auditoria_logs_id_seq OWNED BY public.auditoria_logs.id;


--
-- Name: banco_horas_lancamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banco_horas_lancamentos (
    id bigint NOT NULL,
    empresa_id uuid NOT NULL,
    funcionario_id uuid NOT NULL,
    data_referencia date NOT NULL,
    tipo public.banco_horas_lancamento_tipo NOT NULL,
    minutos integer NOT NULL,
    saldo_acumulado_apos integer NOT NULL,
    apontamento_diario_id uuid,
    observacao text,
    criado_por_usuario_id uuid,
    criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_banco_horas_minutos_nao_zero CHECK ((minutos <> 0))
);


--
-- Name: banco_horas_lancamentos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.banco_horas_lancamentos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: banco_horas_lancamentos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.banco_horas_lancamentos_id_seq OWNED BY public.banco_horas_lancamentos.id;


--
-- Name: departamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    nome character varying(120) NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: dispositivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispositivos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    filial_id uuid,
    descricao character varying(150) NOT NULL,
    modelo character varying(80) DEFAULT 'Facial AI 5'::character varying NOT NULL,
    tipo_biometria public.dispositivo_tipo_biometria DEFAULT 'facial'::public.dispositivo_tipo_biometria NOT NULL,
    situacao public.dispositivo_situacao DEFAULT 'ativo'::public.dispositivo_situacao NOT NULL,
    fuso_horario character varying(60) DEFAULT 'America/Sao_Paulo'::character varying NOT NULL,
    enviar_comprovante_email boolean DEFAULT false NOT NULL,
    modo_conexao public.dispositivo_modo_conexao DEFAULT 'client'::public.dispositivo_modo_conexao NOT NULL,
    ip inet NOT NULL,
    porta integer DEFAULT 4370 NOT NULL,
    nao_validar_empresa boolean DEFAULT false NOT NULL,
    numero_serie character varying(60) NOT NULL,
    mac_address character varying(17),
    ultimo_nsr bigint DEFAULT '0'::bigint NOT NULL,
    ultima_coleta_em timestamp with time zone,
    ultima_coleta_status character varying(30),
    usuario_dispositivo character varying(60),
    senha_dispositivo_cifrada text,
    identificador_equipamento character varying(100),
    protocolo public.dispositivo_protocolo DEFAULT 'desconhecido'::public.dispositivo_protocolo NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_dispositivos_nsr_positivo CHECK ((ultimo_nsr >= 0)),
    CONSTRAINT chk_dispositivos_porta_valida CHECK (((porta >= 1) AND (porta <= 65535)))
);


--
-- Name: empresas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    razao_social character varying(200) NOT NULL,
    nome_fantasia character varying(200),
    cnpj character varying(18) NOT NULL,
    email character varying(150),
    telefone character varying(20),
    endereco character varying(300),
    quantidade_funcionarios_estimada integer DEFAULT 0,
    plano character varying(30) DEFAULT 'basico'::character varying NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_empresas_qtd_funcionarios_positiva CHECK ((quantidade_funcionarios_estimada >= 0))
);


--
-- Name: feriados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feriados (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid,
    data date NOT NULL,
    descricao character varying(150) NOT NULL,
    abrangencia public.feriado_abrangencia DEFAULT 'nacional'::public.feriado_abrangencia NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: filiais; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.filiais (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    nome character varying(150) NOT NULL,
    cnpj character varying(18),
    endereco character varying(300),
    fuso_horario character varying(60) DEFAULT 'America/Sao_Paulo'::character varying NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    tipo public.filial_tipo DEFAULT 'empresa'::public.filial_tipo NOT NULL
);


--
-- Name: funcionario_dispositivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funcionario_dispositivos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    funcionario_id uuid NOT NULL,
    dispositivo_id uuid NOT NULL,
    id_no_dispositivo character varying(40) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: funcionarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funcionarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    filial_id uuid,
    departamento_id uuid,
    horario_trabalho_id uuid,
    matricula character varying(30) NOT NULL,
    nome character varying(150) NOT NULL,
    cpf character varying(14) NOT NULL,
    pis character varying(20),
    cargo character varying(100),
    data_admissao date NOT NULL,
    data_demissao date,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_funcionarios_demissao_apos_admissao CHECK (((data_demissao IS NULL) OR (data_demissao >= data_admissao)))
);


--
-- Name: horarios_trabalho; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horarios_trabalho (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    nome character varying(120) NOT NULL,
    tipo public.horario_tipo DEFAULT 'fixo_semanal'::public.horario_tipo NOT NULL,
    config_semana jsonb DEFAULT '{}'::jsonb NOT NULL,
    carga_horaria_semanal_minutos integer DEFAULT 2640 NOT NULL,
    tolerancia_minutos integer DEFAULT 10 NOT NULL,
    banco_horas_tipo_acordo public.banco_horas_tipo_acordo DEFAULT 'nenhum'::public.banco_horas_tipo_acordo NOT NULL,
    banco_horas_prazo_compensacao_dias integer,
    limite_horas_extras_dia_minutos integer DEFAULT 120 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_horarios_carga_semanal_positiva CHECK ((carga_horaria_semanal_minutos > 0)),
    CONSTRAINT chk_horarios_limite_extras_positivo CHECK ((limite_horas_extras_dia_minutos >= 0)),
    CONSTRAINT chk_horarios_prazo_compensacao_positivo CHECK (((banco_horas_prazo_compensacao_dias IS NULL) OR (banco_horas_prazo_compensacao_dias > 0))),
    CONSTRAINT chk_horarios_tolerancia_positiva CHECK ((tolerancia_minutos >= 0))
);


--
-- Name: justificativas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.justificativas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    funcionario_id uuid NOT NULL,
    tipo public.justificativa_tipo NOT NULL,
    data_inicio date NOT NULL,
    data_fim date NOT NULL,
    anexo_url character varying(300),
    status public.justificativa_status DEFAULT 'pendente'::public.justificativa_status NOT NULL,
    aprovado_por uuid,
    aprovado_em timestamp with time zone,
    observacao text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_justificativas_fim_apos_inicio CHECK ((data_fim >= data_inicio))
);


--
-- Name: knex_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knex_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knex_migrations_lock_index_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    responsavel_id uuid NOT NULL,
    token character varying(200) NOT NULL,
    plataforma public.push_token_plataforma NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: registros_ponto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registros_ponto (
    id bigint NOT NULL,
    empresa_id uuid NOT NULL,
    dispositivo_id uuid,
    funcionario_id uuid,
    nsr bigint,
    data_hora timestamp with time zone NOT NULL,
    tipo_verificacao_bruto integer,
    tipo_batida public.registro_tipo_batida DEFAULT 'indefinido'::public.registro_tipo_batida NOT NULL,
    origem public.registro_origem DEFAULT 'dispositivo'::public.registro_origem NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    foto_url character varying(300),
    id_bruto_nao_resolvido character varying(40),
    processado boolean DEFAULT false NOT NULL,
    criado_por_usuario_id uuid,
    criado_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    aluno_id uuid,
    CONSTRAINT chk_registros_nsr_positivo CHECK (((nsr IS NULL) OR (nsr >= 0))),
    CONSTRAINT chk_registros_pessoa_unica CHECK ((NOT ((funcionario_id IS NOT NULL) AND (aluno_id IS NOT NULL))))
);


--
-- Name: registros_ponto_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.registros_ponto_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: registros_ponto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.registros_ponto_id_seq OWNED BY public.registros_ponto.id;


--
-- Name: responsaveis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.responsaveis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    nome character varying(150) NOT NULL,
    email character varying(150) NOT NULL,
    senha_hash character varying(200) NOT NULL,
    telefone character varying(20),
    ativo boolean DEFAULT true NOT NULL,
    ultimo_login_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: responsavel_alunos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.responsavel_alunos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    responsavel_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    parentesco character varying(40),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: turmas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.turmas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    filial_id uuid NOT NULL,
    nome character varying(100) NOT NULL,
    turno public.turma_turno DEFAULT 'manha'::public.turma_turno NOT NULL,
    ano_letivo integer NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid,
    nome character varying(150) NOT NULL,
    email character varying(150) NOT NULL,
    senha_hash character varying(200) NOT NULL,
    papel public.usuario_papel DEFAULT 'admin'::public.usuario_papel NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ultimo_login_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    filial_id uuid
);


--
-- Name: auditoria_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_logs ALTER COLUMN id SET DEFAULT nextval('public.auditoria_logs_id_seq'::regclass);


--
-- Name: banco_horas_lancamentos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banco_horas_lancamentos ALTER COLUMN id SET DEFAULT nextval('public.banco_horas_lancamentos_id_seq'::regclass);


--
-- Name: registros_ponto id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_ponto ALTER COLUMN id SET DEFAULT nextval('public.registros_ponto_id_seq'::regclass);


--
-- Name: afd_exports afd_exports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.afd_exports
    ADD CONSTRAINT afd_exports_pkey PRIMARY KEY (id);


--
-- Name: aluno_dispositivos aluno_dispositivos_aluno_id_dispositivo_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aluno_dispositivos
    ADD CONSTRAINT aluno_dispositivos_aluno_id_dispositivo_id_unique UNIQUE (aluno_id, dispositivo_id);


--
-- Name: aluno_dispositivos aluno_dispositivos_dispositivo_id_id_no_dispositivo_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aluno_dispositivos
    ADD CONSTRAINT aluno_dispositivos_dispositivo_id_id_no_dispositivo_unique UNIQUE (dispositivo_id, id_no_dispositivo);


--
-- Name: aluno_dispositivos aluno_dispositivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aluno_dispositivos
    ADD CONSTRAINT aluno_dispositivos_pkey PRIMARY KEY (id);


--
-- Name: alunos alunos_empresa_id_matricula_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos
    ADD CONSTRAINT alunos_empresa_id_matricula_unique UNIQUE (empresa_id, matricula);


--
-- Name: alunos alunos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos
    ADD CONSTRAINT alunos_pkey PRIMARY KEY (id);


--
-- Name: apontamentos_diarios apontamentos_diarios_funcionario_id_data_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apontamentos_diarios
    ADD CONSTRAINT apontamentos_diarios_funcionario_id_data_unique UNIQUE (funcionario_id, data);


--
-- Name: apontamentos_diarios apontamentos_diarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apontamentos_diarios
    ADD CONSTRAINT apontamentos_diarios_pkey PRIMARY KEY (id);


--
-- Name: auditoria_logs auditoria_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_logs
    ADD CONSTRAINT auditoria_logs_pkey PRIMARY KEY (id);


--
-- Name: banco_horas_lancamentos banco_horas_lancamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banco_horas_lancamentos
    ADD CONSTRAINT banco_horas_lancamentos_pkey PRIMARY KEY (id);


--
-- Name: departamentos departamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departamentos
    ADD CONSTRAINT departamentos_pkey PRIMARY KEY (id);


--
-- Name: dispositivos dispositivos_empresa_id_numero_serie_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos
    ADD CONSTRAINT dispositivos_empresa_id_numero_serie_unique UNIQUE (empresa_id, numero_serie);


--
-- Name: dispositivos dispositivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos
    ADD CONSTRAINT dispositivos_pkey PRIMARY KEY (id);


--
-- Name: empresas empresas_cnpj_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_cnpj_unique UNIQUE (cnpj);


--
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT empresas_pkey PRIMARY KEY (id);


--
-- Name: feriados feriados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feriados
    ADD CONSTRAINT feriados_pkey PRIMARY KEY (id);


--
-- Name: filiais filiais_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.filiais
    ADD CONSTRAINT filiais_pkey PRIMARY KEY (id);


--
-- Name: funcionario_dispositivos funcionario_dispositivos_dispositivo_id_id_no_dispositivo_uniqu; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionario_dispositivos
    ADD CONSTRAINT funcionario_dispositivos_dispositivo_id_id_no_dispositivo_uniqu UNIQUE (dispositivo_id, id_no_dispositivo);


--
-- Name: funcionario_dispositivos funcionario_dispositivos_funcionario_id_dispositivo_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionario_dispositivos
    ADD CONSTRAINT funcionario_dispositivos_funcionario_id_dispositivo_id_unique UNIQUE (funcionario_id, dispositivo_id);


--
-- Name: funcionario_dispositivos funcionario_dispositivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionario_dispositivos
    ADD CONSTRAINT funcionario_dispositivos_pkey PRIMARY KEY (id);


--
-- Name: funcionarios funcionarios_empresa_id_cpf_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionarios
    ADD CONSTRAINT funcionarios_empresa_id_cpf_unique UNIQUE (empresa_id, cpf);


--
-- Name: funcionarios funcionarios_empresa_id_matricula_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionarios
    ADD CONSTRAINT funcionarios_empresa_id_matricula_unique UNIQUE (empresa_id, matricula);


--
-- Name: funcionarios funcionarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionarios
    ADD CONSTRAINT funcionarios_pkey PRIMARY KEY (id);


--
-- Name: horarios_trabalho horarios_trabalho_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios_trabalho
    ADD CONSTRAINT horarios_trabalho_pkey PRIMARY KEY (id);


--
-- Name: justificativas justificativas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.justificativas
    ADD CONSTRAINT justificativas_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_token_unique UNIQUE (token);


--
-- Name: registros_ponto registros_ponto_dispositivo_id_nsr_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_ponto
    ADD CONSTRAINT registros_ponto_dispositivo_id_nsr_unique UNIQUE (dispositivo_id, nsr);


--
-- Name: registros_ponto registros_ponto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_ponto
    ADD CONSTRAINT registros_ponto_pkey PRIMARY KEY (id);


--
-- Name: responsaveis responsaveis_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsaveis
    ADD CONSTRAINT responsaveis_email_unique UNIQUE (email);


--
-- Name: responsaveis responsaveis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsaveis
    ADD CONSTRAINT responsaveis_pkey PRIMARY KEY (id);


--
-- Name: responsavel_alunos responsavel_alunos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsavel_alunos
    ADD CONSTRAINT responsavel_alunos_pkey PRIMARY KEY (id);


--
-- Name: responsavel_alunos responsavel_alunos_responsavel_id_aluno_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsavel_alunos
    ADD CONSTRAINT responsavel_alunos_responsavel_id_aluno_id_unique UNIQUE (responsavel_id, aluno_id);


--
-- Name: turmas turmas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_unique UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: afd_exports_empresa_id_gerado_em_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX afd_exports_empresa_id_gerado_em_index ON public.afd_exports USING btree (empresa_id, gerado_em);


--
-- Name: alunos_empresa_id_ativo_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alunos_empresa_id_ativo_index ON public.alunos USING btree (empresa_id, ativo);


--
-- Name: alunos_turma_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alunos_turma_id_index ON public.alunos USING btree (turma_id);


--
-- Name: apontamentos_diarios_empresa_id_data_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX apontamentos_diarios_empresa_id_data_index ON public.apontamentos_diarios USING btree (empresa_id, data);


--
-- Name: auditoria_logs_criado_em_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auditoria_logs_criado_em_index ON public.auditoria_logs USING btree (criado_em);


--
-- Name: auditoria_logs_empresa_id_entidade_entidade_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auditoria_logs_empresa_id_entidade_entidade_id_index ON public.auditoria_logs USING btree (empresa_id, entidade, entidade_id);


--
-- Name: banco_horas_lancamentos_empresa_id_funcionario_id_data_referenc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX banco_horas_lancamentos_empresa_id_funcionario_id_data_referenc ON public.banco_horas_lancamentos USING btree (empresa_id, funcionario_id, data_referencia);


--
-- Name: dispositivos_empresa_id_situacao_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dispositivos_empresa_id_situacao_index ON public.dispositivos USING btree (empresa_id, situacao);


--
-- Name: feriados_data_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feriados_data_index ON public.feriados USING btree (data);


--
-- Name: funcionarios_empresa_id_ativo_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX funcionarios_empresa_id_ativo_index ON public.funcionarios USING btree (empresa_id, ativo);


--
-- Name: idx_registros_ponto_aluno_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_registros_ponto_aluno_data ON public.registros_ponto USING btree (empresa_id, aluno_id, data_hora);


--
-- Name: justificativas_empresa_id_funcionario_id_data_inicio_data_fim_i; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX justificativas_empresa_id_funcionario_id_data_inicio_data_fim_i ON public.justificativas USING btree (empresa_id, funcionario_id, data_inicio, data_fim);


--
-- Name: registros_ponto_empresa_id_funcionario_id_data_hora_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX registros_ponto_empresa_id_funcionario_id_data_hora_index ON public.registros_ponto USING btree (empresa_id, funcionario_id, data_hora);


--
-- Name: registros_ponto_processado_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX registros_ponto_processado_index ON public.registros_ponto USING btree (processado);


--
-- Name: turmas_filial_id_ano_letivo_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX turmas_filial_id_ano_letivo_index ON public.turmas USING btree (filial_id, ano_letivo);


--
-- Name: aluno_dispositivos trg_aluno_dispositivos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_aluno_dispositivos_updated_at BEFORE UPDATE ON public.aluno_dispositivos FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at();


--
-- Name: alunos trg_alunos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_alunos_updated_at BEFORE UPDATE ON public.alunos FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at();


--
-- Name: apontamentos_diarios trg_apontamentos_diarios_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_apontamentos_diarios_updated_at BEFORE UPDATE ON public.apontamentos_diarios FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at();


--
-- Name: departamentos trg_departamentos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_departamentos_updated_at BEFORE UPDATE ON public.departamentos FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at();


--
-- Name: dispositivos trg_dispositivos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_dispositivos_updated_at BEFORE UPDATE ON public.dispositivos FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at();


--
-- Name: empresas trg_empresas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_empresas_updated_at BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at();


--
-- Name: feriados trg_feriados_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_feriados_updated_at BEFORE UPDATE ON public.feriados FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at();


--
-- Name: filiais trg_filiais_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_filiais_updated_at BEFORE UPDATE ON public.filiais FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at();


--
-- Name: funcionario_dispositivos trg_funcionario_dispositivos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_funcionario_dispositivos_updated_at BEFORE UPDATE ON public.funcionario_dispositivos FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at();


--
-- Name: funcionarios trg_funcionarios_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_funcionarios_updated_at BEFORE UPDATE ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at();


--
-- Name: horarios_trabalho trg_horarios_trabalho_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_horarios_trabalho_updated_at BEFORE UPDATE ON public.horarios_trabalho FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at();


--
-- Name: justificativas trg_justificativas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_justificativas_updated_at BEFORE UPDATE ON public.justificativas FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at();


--
-- Name: push_tokens trg_push_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_push_tokens_updated_at BEFORE UPDATE ON public.push_tokens FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at();


--
-- Name: responsaveis trg_responsaveis_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_responsaveis_updated_at BEFORE UPDATE ON public.responsaveis FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at();


--
-- Name: responsavel_alunos trg_responsavel_alunos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_responsavel_alunos_updated_at BEFORE UPDATE ON public.responsavel_alunos FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at();


--
-- Name: turmas trg_turmas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_turmas_updated_at BEFORE UPDATE ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at();


--
-- Name: usuarios trg_usuarios_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_usuarios_updated_at BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.definir_updated_at();


--
-- Name: afd_exports afd_exports_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.afd_exports
    ADD CONSTRAINT afd_exports_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: afd_exports afd_exports_gerado_por_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.afd_exports
    ADD CONSTRAINT afd_exports_gerado_por_foreign FOREIGN KEY (gerado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: aluno_dispositivos aluno_dispositivos_aluno_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aluno_dispositivos
    ADD CONSTRAINT aluno_dispositivos_aluno_id_foreign FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;


--
-- Name: aluno_dispositivos aluno_dispositivos_dispositivo_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aluno_dispositivos
    ADD CONSTRAINT aluno_dispositivos_dispositivo_id_foreign FOREIGN KEY (dispositivo_id) REFERENCES public.dispositivos(id) ON DELETE CASCADE;


--
-- Name: alunos alunos_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos
    ADD CONSTRAINT alunos_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: alunos alunos_filial_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos
    ADD CONSTRAINT alunos_filial_id_foreign FOREIGN KEY (filial_id) REFERENCES public.filiais(id) ON DELETE CASCADE;


--
-- Name: alunos alunos_turma_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alunos
    ADD CONSTRAINT alunos_turma_id_foreign FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE SET NULL;


--
-- Name: apontamentos_diarios apontamentos_diarios_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apontamentos_diarios
    ADD CONSTRAINT apontamentos_diarios_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: apontamentos_diarios apontamentos_diarios_funcionario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apontamentos_diarios
    ADD CONSTRAINT apontamentos_diarios_funcionario_id_foreign FOREIGN KEY (funcionario_id) REFERENCES public.funcionarios(id) ON DELETE CASCADE;


--
-- Name: apontamentos_diarios apontamentos_diarios_justificativa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apontamentos_diarios
    ADD CONSTRAINT apontamentos_diarios_justificativa_id_foreign FOREIGN KEY (justificativa_id) REFERENCES public.justificativas(id) ON DELETE SET NULL;


--
-- Name: auditoria_logs auditoria_logs_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_logs
    ADD CONSTRAINT auditoria_logs_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: auditoria_logs auditoria_logs_usuario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_logs
    ADD CONSTRAINT auditoria_logs_usuario_id_foreign FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: banco_horas_lancamentos banco_horas_lancamentos_apontamento_diario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banco_horas_lancamentos
    ADD CONSTRAINT banco_horas_lancamentos_apontamento_diario_id_foreign FOREIGN KEY (apontamento_diario_id) REFERENCES public.apontamentos_diarios(id) ON DELETE SET NULL;


--
-- Name: banco_horas_lancamentos banco_horas_lancamentos_criado_por_usuario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banco_horas_lancamentos
    ADD CONSTRAINT banco_horas_lancamentos_criado_por_usuario_id_foreign FOREIGN KEY (criado_por_usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: banco_horas_lancamentos banco_horas_lancamentos_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banco_horas_lancamentos
    ADD CONSTRAINT banco_horas_lancamentos_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: banco_horas_lancamentos banco_horas_lancamentos_funcionario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banco_horas_lancamentos
    ADD CONSTRAINT banco_horas_lancamentos_funcionario_id_foreign FOREIGN KEY (funcionario_id) REFERENCES public.funcionarios(id) ON DELETE CASCADE;


--
-- Name: departamentos departamentos_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departamentos
    ADD CONSTRAINT departamentos_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: dispositivos dispositivos_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos
    ADD CONSTRAINT dispositivos_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: dispositivos dispositivos_filial_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos
    ADD CONSTRAINT dispositivos_filial_id_foreign FOREIGN KEY (filial_id) REFERENCES public.filiais(id) ON DELETE SET NULL;


--
-- Name: feriados feriados_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feriados
    ADD CONSTRAINT feriados_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: filiais filiais_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.filiais
    ADD CONSTRAINT filiais_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: funcionario_dispositivos funcionario_dispositivos_dispositivo_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionario_dispositivos
    ADD CONSTRAINT funcionario_dispositivos_dispositivo_id_foreign FOREIGN KEY (dispositivo_id) REFERENCES public.dispositivos(id) ON DELETE CASCADE;


--
-- Name: funcionario_dispositivos funcionario_dispositivos_funcionario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionario_dispositivos
    ADD CONSTRAINT funcionario_dispositivos_funcionario_id_foreign FOREIGN KEY (funcionario_id) REFERENCES public.funcionarios(id) ON DELETE CASCADE;


--
-- Name: funcionarios funcionarios_departamento_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionarios
    ADD CONSTRAINT funcionarios_departamento_id_foreign FOREIGN KEY (departamento_id) REFERENCES public.departamentos(id) ON DELETE SET NULL;


--
-- Name: funcionarios funcionarios_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionarios
    ADD CONSTRAINT funcionarios_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: funcionarios funcionarios_filial_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionarios
    ADD CONSTRAINT funcionarios_filial_id_foreign FOREIGN KEY (filial_id) REFERENCES public.filiais(id) ON DELETE SET NULL;


--
-- Name: funcionarios funcionarios_horario_trabalho_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funcionarios
    ADD CONSTRAINT funcionarios_horario_trabalho_id_foreign FOREIGN KEY (horario_trabalho_id) REFERENCES public.horarios_trabalho(id) ON DELETE SET NULL;


--
-- Name: horarios_trabalho horarios_trabalho_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horarios_trabalho
    ADD CONSTRAINT horarios_trabalho_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: justificativas justificativas_aprovado_por_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.justificativas
    ADD CONSTRAINT justificativas_aprovado_por_foreign FOREIGN KEY (aprovado_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: justificativas justificativas_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.justificativas
    ADD CONSTRAINT justificativas_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: justificativas justificativas_funcionario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.justificativas
    ADD CONSTRAINT justificativas_funcionario_id_foreign FOREIGN KEY (funcionario_id) REFERENCES public.funcionarios(id) ON DELETE CASCADE;


--
-- Name: push_tokens push_tokens_responsavel_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_responsavel_id_foreign FOREIGN KEY (responsavel_id) REFERENCES public.responsaveis(id) ON DELETE CASCADE;


--
-- Name: registros_ponto registros_ponto_aluno_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_ponto
    ADD CONSTRAINT registros_ponto_aluno_id_foreign FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE SET NULL;


--
-- Name: registros_ponto registros_ponto_criado_por_usuario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_ponto
    ADD CONSTRAINT registros_ponto_criado_por_usuario_id_foreign FOREIGN KEY (criado_por_usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: registros_ponto registros_ponto_dispositivo_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_ponto
    ADD CONSTRAINT registros_ponto_dispositivo_id_foreign FOREIGN KEY (dispositivo_id) REFERENCES public.dispositivos(id) ON DELETE SET NULL;


--
-- Name: registros_ponto registros_ponto_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_ponto
    ADD CONSTRAINT registros_ponto_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: registros_ponto registros_ponto_funcionario_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registros_ponto
    ADD CONSTRAINT registros_ponto_funcionario_id_foreign FOREIGN KEY (funcionario_id) REFERENCES public.funcionarios(id) ON DELETE SET NULL;


--
-- Name: responsaveis responsaveis_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsaveis
    ADD CONSTRAINT responsaveis_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: responsavel_alunos responsavel_alunos_aluno_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsavel_alunos
    ADD CONSTRAINT responsavel_alunos_aluno_id_foreign FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;


--
-- Name: responsavel_alunos responsavel_alunos_responsavel_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsavel_alunos
    ADD CONSTRAINT responsavel_alunos_responsavel_id_foreign FOREIGN KEY (responsavel_id) REFERENCES public.responsaveis(id) ON DELETE CASCADE;


--
-- Name: turmas turmas_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: turmas turmas_filial_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turmas
    ADD CONSTRAINT turmas_filial_id_foreign FOREIGN KEY (filial_id) REFERENCES public.filiais(id) ON DELETE CASCADE;


--
-- Name: usuarios usuarios_empresa_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_empresa_id_foreign FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: usuarios usuarios_filial_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_filial_id_foreign FOREIGN KEY (filial_id) REFERENCES public.filiais(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


