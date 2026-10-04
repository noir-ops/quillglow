"""Test the RAG schema against real Postgres with pgvector."""
import pathlib, pgserver, psycopg2, random

SQL = pathlib.Path("/home/claude/work/qg/quillglow-main/scripts/017_rag_knowledge_base.sql").read_text()
GRAPH = pathlib.Path("/home/claude/work/qg/quillglow-main/scripts/016_learning_graph.sql").read_text()

db = pgserver.get_server("/tmp/pgtest_rag")
conn = psycopg2.connect(db.get_uri()); conn.autocommit=True; cur=conn.cursor()
cur.execute("""
create schema if not exists auth;
create table auth.users (id uuid primary key);
create role authenticated;
create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
""")
try:
    cur.execute("create extension if not exists vector")
    print("pgvector available")
except Exception as e:
    print("pgvector NOT available:", e); raise SystemExit(0)

cur.execute(GRAPH); cur.execute(SQL); print("migrations applied cleanly\n")

ok=True
def check(l,c,d=""):
    global ok
    print(f"  {'PASS' if c else 'FAIL'}  {l}  {d}")
    if not c: ok=False

A="11111111-1111-1111-1111-111111111111"; B="22222222-2222-2222-2222-222222222222"
cur.execute("insert into auth.users values (%s),(%s)",(A,B))

def vec(seed, dim=1536):
    random.seed(seed); return [random.random() for _ in range(dim)]

def add_source(ns, owner, title):
    cur.execute("""insert into knowledge_sources (namespace,owner_id,title,status)
                   values (%s,%s,%s,'indexed') returning id""",(ns,owner,title))
    return cur.fetchone()[0]

def add_chunk(sid, ns, owner, content, seed, model='text-embedding-3-small'):
    cur.execute("""insert into knowledge_chunks (source_id,namespace,owner_id,content,embedding,embedding_model)
                   values (%s,%s,%s,%s,%s,%s)""",(sid,ns,owner,content,vec(seed),model))

# global syllabus content
s_glob = add_source('syllabus_waec', None, 'WAEC Maths')
add_chunk(s_glob,'syllabus_waec',None,'Quadratic equations are solved using the quadratic formula',1)
add_chunk(s_glob,'syllabus_waec',None,'Fractions represent parts of a whole number',2)
# user A private notes
s_a = add_source('user_upload', A, "A's notes")
add_chunk(s_a,'user_upload',A,'My secret notes about quadratic equations from class',3)
# user B private notes
s_b = add_source('user_upload', B, "B's notes")
add_chunk(s_b,'user_upload',B,'B private notes on quadratics',4)

print("1) tenant isolation (the critical one)")
q=vec(3)  # identical to A's note embedding -> would rank #1 if not filtered
cur.execute("""select content from search_knowledge(%s::vector,'quadratic',
              array['syllabus_waec','user_upload'],%s,'text-embedding-3-small',10,null)""",(q,B))
res=[r[0] for r in cur.fetchall()]
check("user B cannot see user A's notes", not any('secret' in r for r in res), f"{len(res)} hits")
check("user B DOES see own notes", any('B private' in r for r in res))
check("user B sees global syllabus", any('quadratic formula' in r.lower() for r in res))

cur.execute("""select content from search_knowledge(%s::vector,'quadratic',
              array['user_upload'],%s,'text-embedding-3-small',10,null)""",(q,A))
resA=[r[0] for r in cur.fetchall()]
check("user A sees own notes", any('secret' in r for r in resA))

print("\n2) embedding model isolation")
add_chunk(s_glob,'syllabus_waec',None,'Gemini-embedded chunk about quadratics',5,'gemini-embedding-001')
cur.execute("""select content from search_knowledge(%s::vector,'quadratic',
              array['syllabus_waec'],null,'text-embedding-3-small',10,null)""",(q,))
r1=[x[0] for x in cur.fetchall()]
check("gemini chunks excluded when openai model active", not any('Gemini-embedded' in x for x in r1))
cur.execute("""select content from search_knowledge(%s::vector,'quadratic',
              array['syllabus_waec'],null,'gemini-embedding-001',10,null)""",(q,))
r2=[x[0] for x in cur.fetchall()]
check("gemini chunks returned when gemini model active", any('Gemini-embedded' in x for x in r2))

print("\n3) hybrid search (lexical rescue)")
# A chunk with an unrelated embedding but exact keyword match
add_chunk(s_glob,'syllabus_waec',None,'Pythagoras theorem states a squared plus b squared',999)
qfar=vec(12345)
cur.execute("""select content,score from search_knowledge(%s::vector,'Pythagoras theorem',
              array['syllabus_waec'],null,'text-embedding-3-small',5,null)""",(qfar,))
hits=cur.fetchall()
check("lexical match surfaces despite distant vector", any('Pythagoras' in h[0] for h in hits), f"top={hits[0][0][:40] if hits else 'none'}")

print("\n4) namespace scoping")
cur.execute("""select count(*) from search_knowledge(%s::vector,'quadratic',
              array['scholarships'],%s,'text-embedding-3-small',10,null)""",(q,A))
check("empty namespace returns nothing", cur.fetchone()[0]==0)

print("\n5) concept filter")
cur.execute("insert into learning_concepts (syllabus,subject,name,slug,depth) values ('WAEC','Math','Quadratics','q',2) returning id")
cid=cur.fetchone()[0]
cur.execute("update knowledge_chunks set concept_id=%s where content like 'Quadratic equations%%'",(cid,))
cur.execute("""select count(*) from search_knowledge(%s::vector,'quadratic',
              array['syllabus_waec'],null,'text-embedding-3-small',10,%s)""",(q,cid))
check("concept filter narrows results", cur.fetchone()[0]==1)

print("\n6) index status view")
cur.execute("select namespace,embedding_model,chunk_count from knowledge_index_status order by embedding_model")
rows=cur.fetchall()
check("reports per-model breakdown", len(rows)>=2, str(rows))

print("\n7) dedup guard")
cur.execute("insert into knowledge_sources (namespace,title,checksum) values ('syllabus_waec','dup','abc')")
try:
    cur.execute("insert into knowledge_sources (namespace,title,checksum) values ('syllabus_waec','dup2','abc')")
    check("duplicate checksum rejected", False, "insert succeeded")
except Exception:
    check("duplicate checksum rejected", True)

print("\n"+"="*55); print("RESULT:", "ALL PASS" if ok else "FAILURES"); print("="*55)
db.cleanup()
