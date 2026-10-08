import React, {useEffect, useRef, useState} from 'react';
import {IconContext, List, X, Sun, Moon, Desktop, Check} from '@phosphor-icons/react';
import SurveyNotice from './SurveyNotice.jsx';

const titles={'/':'익숙한 목소리, 새로운 이야기','/studio':'스튜디오','/notify':'공개 알림'};
const cleanPath=()=>window.location.pathname.replace(/\/$/,'')||'/';
function Link({to,children,className='',onClick,...props}){return <a href={to} className={className} {...props} onClick={e=>{onClick?.(e);if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();window.history.pushState({},'',to);window.dispatchEvent(new PopStateEvent('popstate'));window.scrollTo({top:0,behavior:'instant'});}}>{children}</a>}
function Reveal({children,className='',as:Element='div',...props}){
  const ref=useRef(null);
  useEffect(()=>{
    const el=ref.current;
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer;
    const observe=()=>{
      observer?.disconnect();
      el.classList.remove('motion-ready');
      el.classList.add('is-visible');
      if(preference.matches||!('IntersectionObserver' in window))return;
      el.classList.add('motion-ready');
      observer=new IntersectionObserver(([entry])=>{
        el.classList.toggle('is-visible',entry.isIntersecting);
      },{rootMargin:'-1px 0px -8% 0px',threshold:0});
      observer.observe(el);
    };
    observe();
    preference.addEventListener('change',observe);
    return()=>{observer?.disconnect();preference.removeEventListener('change',observe)};
  },[]);
  return <Element ref={ref} className={`reveal ${className}`} {...props}>{children}</Element>
}
function Header({path,theme,setTheme}){const [open,setOpen]=useState(false);const toggle=useRef(null);useEffect(()=>{setOpen(false)},[path]);useEffect(()=>{if(!open)return;const key=e=>{if(e.key==='Escape'){setOpen(false);toggle.current?.focus()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[open]);const themeNames={system:'시스템',light:'밝게',dark:'어둡게'};const ThemeIcon=theme==='system'?Desktop:theme==='dark'?Moon:Sun;return <header className={`site-header ${titles[path]?'over-media':''}`}><div className="nav-shell"><Link to="/" className="wordmark">V-TAKE<span>STUDIO</span></Link><nav className="desktop-nav" aria-label="주 메뉴"><Link to="/studio" aria-current={path==='/studio'?'page':undefined}>스튜디오</Link></nav><div className="nav-actions"><button className="icon-button theme-toggle" onClick={()=>setTheme(theme==='system'?'dark':theme==='dark'?'light':'system')} aria-label={`화면 테마: ${themeNames[theme]}. 눌러 변경`} title={`화면 테마: ${themeNames[theme]}`}><ThemeIcon size={20}/></button><Link to="/notify" className="button primary small" aria-current={path==='/notify'?'page':undefined}>공개 알림</Link><button ref={toggle} className="icon-button menu-toggle" aria-expanded={open} aria-controls="mobile-menu" aria-label={open?'메뉴 닫기':'메뉴 열기'} onClick={()=>setOpen(!open)}>{open?<X size={24}/>:<List size={24}/>}</button></div></div>{open&&<nav id="mobile-menu" className="mobile-nav" aria-label="모바일 주 메뉴"><Link to="/" onClick={()=>setOpen(false)}>홈</Link><Link to="/studio" onClick={()=>setOpen(false)}>스튜디오</Link></nav>}</header>}
function Footer({openPrivacy}){return <footer className="footer wrap"><div className="footer-top"><Link to="/" className="wordmark">V-TAKE<span>STUDIO</span></Link><div className="footer-links"><Link to="/studio">스튜디오</Link><button className="text-button" onClick={openPrivacy}>개인정보 안내</button></div></div><p className="footer-copy">© 2026 V-TAKE STUDIO</p></footer>}
function Breadcrumb({name}){return <div className="breadcrumb"><Link to="/">홈</Link><span aria-hidden="true">/</span><span>{name}</span></div>}
function SceneImage({className='',...props}){
  const ref=useRef(null);
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{setLoaded(ref.current?.complete||false)},[props.src]);
  return <img {...props} ref={ref} className={`scene-image ${className}${loaded?' is-loaded':''}`} onLoad={()=>setLoaded(true)} onError={()=>setLoaded(true)}/>
}
function Art({src,alt,caption,className='',priority=false}){return <figure className={`art ${className}`}><SceneImage src={`/assets/${src}.webp`} alt={alt} width="1672" height="941" loading={priority?'eager':'lazy'} fetchPriority={priority?'high':undefined}/>{caption&&<figcaption>{caption}</figcaption>}</figure>}
function Home({openSurvey}){return <>
  <section className="hero" aria-labelledby="home-title">
    <SceneImage className="hero-image" src="/assets/hero.webp" alt="비 내리는 밤, 열차 창가에 앉은 버추얼 배우의 장면 콘셉트" width="1672" height="941" fetchPriority="high"/>
    <div className="hero-shade"/>
    <div className="hero-content wrap">
      <h1 id="home-title">익숙한 목소리,<br/>새로운 이야기.</h1>
      <p>버추얼 크리에이터가 배우로 출연하는<br className="hero-desktop-break"/>{' '}<span className="hero-format">영화와 드라마.</span></p>
      <div className="hero-actions"><Link className="button primary" to="/notify">공개 알림</Link><button className="button hero-secondary" onClick={openSurvey}>설문하기</button></div>
    </div>
  </section>
  <Reveal as="section" id="studio-scene" className="story-section wrap" aria-labelledby="story-title">
    <div className="story-grid">
      <div className="story-copy motion-piece">
        <h2 id="story-title">방송 밖에서도,<br/>새로운 배역을 맡습니다.</h2>
        <p>이야기와 배역을 먼저 구상합니다.<br className="desktop-break"/> 그 역할에 맞는 크리에이터와 함께 작품을 만듭니다.</p>
        <Link className="inline-link" to="/studio">스튜디오 보기</Link>
      </div>
      <div className="scene-row">
        <Art src="rehearsal" alt="밝은 리허설실에서 양손에 대본을 들고 연습하는 여성 버추얼 배우" className="rehearsal-art motion-piece"/>
        <Art src="production" alt="모션캡처 촬영과 가상 세트를 연결한 제작 환경 예시" caption="제작 환경 콘셉트" className="production-art motion-piece"/>
      </div>
    </div>
  </Reveal>
  <Reveal as="section" id="release-scene" className="closing-section" aria-labelledby="closing-title">
    <Art src="closing" alt="비가 갠 밤거리에서 극장 앞을 걸어가는 여성의 장면 콘셉트" className="closing-art"/>
    <div className="closing-shade"/>
    <div className="closing-grid wrap">
      <div className="closing-copy motion-piece">
        <h2 id="closing-title">새로운 장면이 공개되면<br/>함께 감상해 보세요.</h2>
        <p>작품 공개 소식을 이메일로 알려드릴 예정입니다.</p>
        <Link to="/notify" className="button primary">공개 알림</Link>
      </div>
    </div>
  </Reveal>
</>}
function Studio(){return <section className="detail-page wrap" aria-labelledby="studio-title"><Breadcrumb name="스튜디오"/><div className="studio-layout"><Art src="production" alt="촬영 카메라와 모션캡처 연기자가 있는 협력 제작 환경 콘셉트" caption="제작 환경 콘셉트" className="studio-image" priority/><div className="studio-copy"><h1 id="studio-title">이야기를 시작으로<br/>작품을 만듭니다.</h1><p className="lead">크리에이터의 연기를 한 편의 영화·드라마로 완성할 콘텐츠 스튜디오를 준비합니다.</p><div className="process-groups"><div><h2>이야기와 배역</h2><p>각본 속 인물에 맞는 목소리와 연기를 찾습니다. 출연자를 처음 보는 관객도 이야기를 따라갈 수 있도록 작품을 구성합니다.</p></div><div><h2>연기와 가상 촬영</h2><p>협력 촬영 환경에서 연기를 기록하고 가상 세트의 카메라와 조명으로 장면을 구성할 계획입니다.</p></div><div><h2>검수와 공개</h2><p>인물의 일관성을 살피고 대사, 움직임, 자막을 확인합니다. 콘셉트 구상과 보정에는 AI를 제작 보조 수단으로 활용합니다.</p></div></div><Link to="/notify" className="inline-link">공개 알림</Link></div></div></section>}
function PrivacyDialog({onClose}){const ref=useRef(null);useEffect(()=>{const previous=document.activeElement;ref.current.showModal();document.body.style.overflow='hidden';return()=>{document.body.style.overflow='';previous?.focus();}},[]);return <dialog ref={ref} className="privacy-dialog" aria-labelledby="privacy-title" onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===ref.current)onClose()}}><div className="dialog-heading"><h2 id="privacy-title">개인정보 안내</h2><button className="icon-button" autoFocus onClick={onClose} aria-label="개인정보 안내 닫기"><X size={22}/></button></div><p>이 사이트는 화면과 이용 동선을 살펴보기 위한 시안입니다.</p><div className="privacy-body"><h3>입력한 정보</h3><p>입력한 이메일은 서버로 전송되지 않습니다. 화면을 이동하거나 새로고침하면 지워집니다.</p><h3>실제 알림 신청</h3><p>현재는 신청을 접수하거나 이메일을 발송하지 않습니다. 실제 서비스 운영 전에는 수집 목적, 보관 기간과 철회 방법을 별도로 안내할 예정입니다.</p><h3>화면 설정</h3><p>선택한 화면 테마만 이 브라우저에 저장됩니다.</p></div><button className="button primary" onClick={onClose}>확인</button></dialog>}
function Notify({openPrivacy}){const [email,setEmail]=useState('');const [consent,setConsent]=useState(false);const [errors,setErrors]=useState({});const [state,setState]=useState('idle');const timer=useRef(null);const emailRef=useRef(null);const consentRef=useRef(null);useEffect(()=>()=>clearTimeout(timer.current),[]);const submit=e=>{e.preventDefault();const next={};if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))next.email='이메일 주소를 확인해 주세요.';if(!consent)next.consent='알림 수신 동의 항목을 선택해 주세요.';setErrors(next);if(Object.keys(next).length){(next.email?emailRef:consentRef).current?.focus();return;}setState('loading');timer.current=setTimeout(()=>{setEmail('');setConsent(false);setState('preview');},600)};return <section className="detail-page form-page wrap" aria-labelledby="notify-title"><Breadcrumb name="공개 알림"/><div className="form-layout"><div className="form-copy">{state==='preview'?<div className="success-content" role="status"><div className="success-icon"><Check size={30}/></div><h1 id="notify-title">입력 내용을<br/>확인했어요.</h1><p className="lead">이 화면은 이용 흐름을 확인하기 위한 시안입니다. 실제 신청 접수와 이메일 발송은 이루어지지 않습니다.</p><div className="success-actions"><Link className="button primary" to="/">홈으로</Link><button className="button secondary" onClick={()=>setState('idle')}>다시 입력</button></div></div>:<><h1 id="notify-title">작품 공개 소식</h1><p className="lead">작품 공개 일정이 정해지면<br/>이메일로 소식을 전해드릴 예정입니다.</p><form onSubmit={submit} noValidate aria-busy={state==='loading'}><div className="field"><label htmlFor="email">이메일</label><input ref={emailRef} id="email" type="email" autoComplete="email" inputMode="email" placeholder="name@example.com" value={email} onChange={e=>{setEmail(e.target.value);if(errors.email)setErrors({...errors,email:null})}} disabled={state==='loading'} aria-invalid={!!errors.email} aria-describedby="email-help email-error"/><span id="email-help" className="help">작품 공개 소식을 받을 이메일 주소를 입력해 주세요.</span><span id="email-error" className="error" aria-live="polite">{errors.email}</span></div><div className="consent-block"><label className="checkbox-label"><input ref={consentRef} type="checkbox" checked={consent} onChange={e=>{setConsent(e.target.checked);if(errors.consent)setErrors({...errors,consent:null})}} disabled={state==='loading'} aria-invalid={!!errors.consent} aria-describedby="consent-error"/><span>공개 알림을 위한 개인정보 이용에 동의합니다.</span></label><button type="button" className="inline-link privacy-link" onClick={openPrivacy}>개인정보 안내</button><span id="consent-error" className="error" aria-live="polite">{errors.consent}</span></div><button className="button primary submit-button" type="submit" disabled={state==='loading'}>{state==='loading'?'입력 확인 중':'공개 알림'}</button>{state==='loading'&&<div className="loading-line" role="status" aria-label="입력 확인 중"/>}<p className="prototype-note">시안에서 입력한 정보는 전송되지 않습니다.</p></form></>}</div><Art src="hero" alt="비 내리는 열차 창가의 버추얼 배우 장면" caption="장면 콘셉트" className="form-art" priority/></div></section>}
function NotFound(){return <section className="not-found wrap"><h1>페이지를 찾을 수 없어요.</h1><p>홈으로 돌아가 스튜디오의 이야기를 살펴보세요.</p><Link className="button primary" to="/">홈으로</Link></section>}
export default function App(){const [path,setPath]=useState(cleanPath);const [privacy,setPrivacy]=useState(false);const [surveyNotice,setSurveyNotice]=useState(false);const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('vtake-theme')||'system'}catch{return 'system'}});useEffect(()=>{const onPop=()=>{setPath(cleanPath());setPrivacy(false);setSurveyNotice(false)};window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)},[]);useEffect(()=>{if(theme==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=theme;try{localStorage.setItem('vtake-theme',theme)}catch{}},[theme]);useEffect(()=>{document.title=`V-TAKE STUDIO | ${titles[path]||'페이지 안내'}`;document.querySelector('main')?.focus({preventScroll:true})},[path]);return <IconContext.Provider value={{weight:'regular'}}><a className="skip-link" href="#content">본문으로 이동</a><Header path={path} theme={theme} setTheme={setTheme}/><main id="content" tabIndex={-1} key={path}>{path==='/'?<Home openSurvey={()=>setSurveyNotice(true)}/>:path==='/studio'?<Studio/>:path==='/notify'?<Notify openPrivacy={()=>setPrivacy(true)}/>:<NotFound/>}</main><Footer openPrivacy={()=>setPrivacy(true)}/>{privacy&&<PrivacyDialog onClose={()=>setPrivacy(false)}/>} {surveyNotice&&<SurveyNotice onClose={()=>setSurveyNotice(false)}/>}</IconContext.Provider>}
