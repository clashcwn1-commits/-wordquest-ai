console.info("WordQuest AI frontend v1.1-fix");

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

let sets=JSON.parse(localStorage.getItem("wqai_sets")||"null")||[
 {
   id:crypto.randomUUID(),
   name:"Німецька — базові слова",
   cards:[
     {q:"Haus",a:"будинок"},
     {q:"Katze",a:"кіт"},
     {q:"gehen",a:"йти"},
     {q:"essen",a:"їсти"},
     {q:"trinken",a:"пити"},
     {q:"lernen",a:"вчитися"},
     {q:"arbeiten",a:"працювати"},
     {q:"schlafen",a:"спати"}
   ],
   known:{}
 }
];

let current=null;
let gameMode=null;
let order=[];
let idx=0;
let first=null;
let matched=0;
let generated=null;

function save(){
  localStorage.setItem("wqai_sets",JSON.stringify(sets));
}

function sh(a){
  return [...a].sort(()=>Math.random()-.5);
}

function norm(s){
  return (s||"")
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g,"")
    .replace(/\s+/g," ");
}

function page(id){
  $$(".page").forEach(x=>x.classList.remove("active"));
  $("#"+id).classList.add("active");

  $$("nav button").forEach(b=>
    b.classList.toggle("navactive",b.dataset.page===id)
  );

  if(id==="home") renderSets();
  if(id==="create") resetEditor();

  window.scrollTo({
    top:0,
    behavior:"smooth"
  });
}

$$("[data-page]").forEach(b=>{
  b.onclick=()=>page(b.dataset.page);
});

$$(".back").forEach(b=>{
  b.onclick=()=>page("home");
});

$("#gameBack").onclick=()=>openStudy(current?.id);

function renderSets(){
  $("#setsCount").textContent=`${sets.length} наборів`;
  $("#sets").innerHTML="";

  sets.forEach(s=>{
    const d=document.createElement("div");

    d.className="setcard";

    d.innerHTML=`
      <div>
        <h3>${esc(s.name)}</h3>
        <p>${s.cards.length} карток</p>
      </div>
      <button class="open">Вчити →</button>
    `;

    d.querySelector(".open").onclick=()=>openStudy(s.id);

    $("#sets").appendChild(d);
  });
}

function openStudy(id){
  current=sets.find(x=>x.id===id);

  if(!current){
    return page("home");
  }

  $("#studyTitle").textContent=current.name;
  $("#studyMeta").textContent=`${current.cards.length} карток`;

  const knownCount=Object
    .values(current.known||{})
    .filter(Boolean)
    .length;

  const progress=current.cards.length
    ? Math.round(knownCount/current.cards.length*100)
    : 0;

  $("#progressText").textContent=progress+"%";
  $("#progressBar").style.width=progress+"%";

  pageRaw("study");
}

function pageRaw(id){
  $$(".page").forEach(x=>x.classList.remove("active"));

  $("#"+id).classList.add("active");

  $$("nav button").forEach(b=>
    b.classList.remove("navactive")
  );

  window.scrollTo(0,0);
}

function resetEditor(){
  $("#setName").value="";
  $("#cardEditor").innerHTML="";

  for(let i=0;i<4;i++){
    addRow();
  }
}

function addRow(q="",a=""){
  const r=document.createElement("div");

  r.className="cardrow";

  r.innerHTML=`
    <input
      class="q"
      placeholder="Слово / питання"
      value="${esc(q)}"
    >

    <input
      class="a"
      placeholder="Переклад / відповідь"
      value="${esc(a)}"
    >

    <button>×</button>
  `;

  r.querySelector("button").onclick=()=>r.remove();

  $("#cardEditor").appendChild(r);
}

$("#addCard").onclick=()=>addRow();

$("#saveSet").onclick=()=>{
  const cards=$$("#cardEditor .cardrow")
    .map(r=>({
      q:r.querySelector(".q").value.trim(),
      a:r.querySelector(".a").value.trim()
    }))
    .filter(x=>x.q&&x.a);

  if(!cards.length){
    return alert("Додай хоча б одну картку.");
  }

  sets.unshift({
    id:crypto.randomUUID(),
    name:$("#setName").value.trim()||"Мій набір",
    cards,
    known:{}
  });

  save();
  page("home");
};


/* ==============================
   AI GENERATOR
============================== */

$("#generate").onclick=async()=>{

  const prompt=$("#aiPrompt").value.trim();

  if(!prompt){
    $("#aiStatus").textContent="Напиши тему або завдання.";
    return;
  }

  $("#generate").disabled=true;
  $("#aiStatus").textContent="AI створює картки…";
  $("#aiResult").classList.add("hidden");

  try{

    const apiUrl=new URL(
      "/api/generate",
      window.location.origin
    ).href;

    console.log("AI request:",apiUrl);

    const res=await fetch(apiUrl,{
      method:"POST",

      headers:{
        "Content-Type":"application/json",
        "Accept":"application/json"
      },

      cache:"no-store",

      body:JSON.stringify({
        prompt,
        count:Number($("#aiCount").value),
        type:$("#aiType").value
      })
    });

    const raw=await res.text();

    console.log("AI response status:",res.status);
    console.log("AI response:",raw);

    let data;

    try{
      data=JSON.parse(raw);
    }catch{
      throw new Error(
        `Сервер повернув неправильну відповідь (${res.status}).`
      );
    }

    if(!res.ok){
      throw new Error(
        data?.error||
        `Помилка сервера: ${res.status}`
      );
    }

    if(
      !data ||
      !Array.isArray(data.cards)
    ){
      throw new Error(
        "AI повернув неправильний формат карток."
      );
    }

    if(!data.cards.length){
      throw new Error(
        "AI не створив жодної картки."
      );
    }

    generated=data;

    $("#generatedPreview").innerHTML=
      generated.cards
      .map(c=>`
        <div class="preview">
          <span>${esc(c.q)}</span>
          <span>${esc(c.a)}</span>
        </div>
      `)
      .join("");

    $("#aiResult").classList.remove("hidden");

    $("#aiStatus").textContent=
      `Готово: ${generated.cards.length} карток`;

  }catch(e){

    console.error(
      "WordQuest AI error:",
      e
    );

    $("#aiStatus").textContent=
      "⚠️ "+(
        e?.message||
        String(e)
      );

  }finally{

    $("#generate").disabled=false;

  }
};


/* ==============================
   GENERATED CARDS
============================== */

$("#saveGenerated").onclick=()=>{

  if(!generated){
    return;
  }

  sets.unshift({
    id:crypto.randomUUID(),
    name:generated.title||"AI набір",
    cards:generated.cards,
    known:{}
  });

  save();
  page("home");
};

$("#editGenerated").onclick=()=>{

  if(!generated){
    return;
  }

  pageRaw("create");

  $("#setName").value=
    generated.title||"";

  $("#cardEditor").innerHTML="";

  generated.cards.forEach(c=>
    addRow(c.q,c.a)
  );
};


/* ==============================
   STUDY MODES
============================== */

$$("[data-mode]").forEach(b=>{
  b.onclick=()=>startGame(b.dataset.mode);
});

function startGame(mode){

  if(
    !current ||
    !current.cards.length
  ){
    return;
  }

  gameMode=mode;

  order=sh(
    current.cards.map((_,i)=>i)
  );

  idx=0;
  first=null;
  matched=0;

  const names={
    flash:"Картки",
    quiz:"Тест",
    type:"Напиши",
    match:"Match"
  };

  $("#gameTitle").textContent=
    names[mode];

  pageRaw("game");

  renderGame();
}

function renderGame(){

  if(gameMode==="match"){
    return renderMatch();
  }

  if(idx>=order.length){
    idx=0;
    order=sh(order);
  }

  $("#gameCounter").textContent=
    `${idx+1} / ${order.length}`;

  const c=
    current.cards[order[idx]];

  if(gameMode==="flash"){

    $("#gameArea").innerHTML=`
      <div
        class="flash"
        id="fc"
      >
        <div class="flashin">

          <div class="face">
            <b>${esc(c.q)}</b>
          </div>

          <div class="face backf">
            <b>${esc(c.a)}</b>
          </div>

        </div>
      </div>

      <div class="actions">
        <button
          class="wrong"
          id="again"
        >
          Ще раз
        </button>

        <button
          class="right"
          id="know"
        >
          Знаю
        </button>
      </div>
    `;

    $("#fc").onclick=()=>
      $("#fc")
      .classList
      .toggle("flipped");

    $("#again").onclick=()=>
      next(false);

    $("#know").onclick=()=>
      next(true);

  }

  else if(gameMode==="quiz"){

    const wrong=
      sh(
        current.cards
        .filter(x=>x!==c)
      )
      .slice(0,3)
      .map(x=>x.a);

    const opts=
      sh([
        c.a,
        ...wrong
      ]);

    $("#gameArea").innerHTML=`
      <div class="gamebox">

        <div class="bigword">
          ${esc(c.q)}
        </div>

        <div
          class="options"
          id="opts"
        ></div>

        <div
          class="feedback"
          id="fb"
        ></div>

      </div>
    `;

    opts.forEach(o=>{

      const b=
        document.createElement("button");

      b.className="option";
      b.textContent=o;

      b.onclick=()=>
        answerQuiz(
          b,
          o,
          c
        );

      $("#opts").appendChild(b);

    });

  }

  else{

    $("#gameArea").innerHTML=`
      <div class="gamebox">

        <div class="bigword">
          ${esc(c.q)}
        </div>

        <input
          id="typeans"
          placeholder="Введи відповідь"
        >

        <button
          class="primary wide"
          id="check"
        >
          Перевірити
        </button>

        <div
          class="feedback"
          id="fb"
        ></div>

      </div>
    `;

    $("#check").onclick=()=>{

      const ok=
        norm(
          $("#typeans").value
        )
        ===
        norm(c.a);

      $("#fb").textContent=
        ok
        ? "✅ Правильно!"
        : "❌ Правильно: "+c.a;

      setTimeout(
        ()=>next(ok),
        800
      );

    };

  }
}

function next(ok){

  const c=
    current.cards[order[idx]];

  current.known=
    current.known||{};

  current.known[
    c.q+"|"+c.a
  ]=ok;

  save();

  idx++;

  renderGame();
}

function answerQuiz(
  btn,
  answer,
  card
){

  $$(".option")
    .forEach(x=>
      x.disabled=true
    );

  const ok=
    norm(answer)
    ===
    norm(card.a);

  btn.classList.add(
    ok
    ? "correct"
    : "bad"
  );

  $("#fb").textContent=
    ok
    ? "✅ Правильно!"
    : "❌ Правильно: "+card.a;

  setTimeout(
    ()=>next(ok),
    850
  );
}


/* ==============================
   MATCH GAME
============================== */

function renderMatch(){

  const pool=
    sh(current.cards)
    .slice(
      0,
      Math.min(
        6,
        current.cards.length
      )
    );

  const tiles=[];

  pool.forEach((c,i)=>{

    tiles.push({
      id:i,
      t:"q",
      x:c.q
    });

    tiles.push({
      id:i,
      t:"a",
      x:c.a
    });

  });

  $("#gameCounter").textContent=
    `${pool.length} пар`;

  $("#gameArea").innerHTML=`
    <div
      class="matchgrid"
      id="mg"
    ></div>
  `;

  sh(tiles).forEach(t=>{

    const b=
      document.createElement("button");

    b.className="tile";
    b.textContent=t.x;

    b.dataset.id=t.id;
    b.dataset.t=t.t;

    b.onclick=()=>
      pick(
        b,
        pool.length
      );

    $("#mg").appendChild(b);

  });
}

function pick(
  b,
  total
){

  if(
    b===first ||
    b.classList.contains("done")
  ){
    return;
  }

  if(!first){

    first=b;
    b.classList.add("sel");

    return;
  }

  const old=first;

  const ok=
    old.dataset.id===
    b.dataset.id
    &&
    old.dataset.t!==
    b.dataset.t;

  first=null;

  b.classList.add("sel");

  if(ok){

    setTimeout(()=>{

      old.classList.add("done");
      b.classList.add("done");

      old.classList.remove("sel");
      b.classList.remove("sel");

      matched++;

      if(matched===total){

        setTimeout(()=>{

          alert("🏆 Готово!");

          openStudy(
            current.id
          );

        },200);

      }

    },180);

  }

  else{

    setTimeout(()=>{

      old.classList.remove("sel");
      b.classList.remove("sel");

    },400);

  }
}


/* ==============================
   SECURITY / ESCAPE HTML
============================== */

function esc(s){

  return String(s??"")
    .replace(
      /[&<>"']/g,
      m=>({
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        '"':"&quot;",
        "'":"&#39;"
      }[m])
    );
}


/* ==============================
   THEME
============================== */

$("#theme").onclick=()=>{

  document.body
    .classList
    .toggle("light");

  localStorage.setItem(
    "wqai_theme",
    document.body
      .classList
      .contains("light")
      ? "light"
      : "dark"
  );

  $("#theme").textContent=
    document.body
      .classList
      .contains("light")
      ? "🌙"
      : "☀️";
};

if(
  localStorage.getItem(
    "wqai_theme"
  )==="light"
){

  document.body
    .classList
    .add("light");

  $("#theme").textContent="🌙";
}

renderSets();
