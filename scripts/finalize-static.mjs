import {cpSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
const html=readFileSync('dist/index.html','utf8');
for(const [route,title] of [['studio','스튜디오'],['notify','공개 알림']]){
  mkdirSync(`dist/${route}`,{recursive:true});
  writeFileSync(`dist/${route}/index.html`,html.replace(/<title>.*?<\/title>/,`<title>V-TAKE STUDIO | ${title}</title>`));
}
cpSync('dist/index.html','dist/404.html');
console.log('Static routes: /, /studio, /notify');
