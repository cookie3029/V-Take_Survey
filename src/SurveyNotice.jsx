import React,{useEffect,useRef} from 'react';
import {X} from '@phosphor-icons/react';
export default function SurveyNotice({onClose}){
 const ref=useRef(null);
 useEffect(()=>{const previous=document.activeElement;ref.current.showModal();document.body.style.overflow='hidden';return()=>{document.body.style.overflow='';previous?.focus()}},[]);
 return <dialog ref={ref} className="privacy-dialog survey-notice" aria-labelledby="survey-notice-title" onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===ref.current)onClose()}}><div className="dialog-heading"><h2 id="survey-notice-title">설문을 준비하고 있어요.</h2><button autoFocus className="icon-button" aria-label="설문 안내 닫기" onClick={onClose}><X size={22}/></button></div><p>참여 링크가 열리면 이곳에서 안내해 드릴게요.</p><button className="button primary" onClick={onClose}>확인</button></dialog>
}
