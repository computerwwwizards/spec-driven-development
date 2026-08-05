
export function initCipher(document: Document){
  const mainForm = document.querySelector("form")
  const aside = document.querySelector("aside")
  mainForm?.addEventListener("submit", (event)=>{
    event.preventDefault();
    const {target, submitter} = event;
    
    const data = new FormData(target, submitter);
    const action = data.get("action")
    const content = data.get("content")
  
    const direction = action === 'cipher' ? 1: -1;
  
    aside.textContent = cipher(content, direction*3);
  })
}






function cipher(content: string, key: number): string {
  let result = "";

  const shift = ((key % 26) + 26) % 26;

  for (const char of content) {
    const code = char.charCodeAt(0);

    if (code >= 65 && code <= 90) {
      result += String.fromCharCode(((code - 65 + shift) % 26) + 65);
    } 

    else if (code >= 97 && code <= 122) {
      result += String.fromCharCode(((code - 97 + shift) % 26) + 97);
    } 

    else {
      result += char;
    }
  }

  return result;
}