// Pointer light stays local to project artwork, with no idle render loop.
const finePointer=matchMedia('(hover:hover) and (pointer:fine)');
document.querySelectorAll('.project').forEach(project=>{
  let frame=0, x=0, y=0;
  const reset=()=>{if(frame)cancelAnimationFrame(frame);frame=0;project.style.removeProperty('--art-x');project.style.removeProperty('--art-y');};
  project.addEventListener('pointermove',event=>{
    if(!finePointer.matches||document.body.classList.contains('motion-paused'))return;
    x=event.clientX;y=event.clientY;
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;const bounds=project.getBoundingClientRect();
      project.style.setProperty('--light-x',`${x-bounds.left}px`);project.style.setProperty('--light-y',`${y-bounds.top}px`);
      project.style.setProperty('--art-x',`${Math.max(-1.6,Math.min(1.6,(.5-(y-bounds.top)/bounds.height)*3.2))}deg`);
      project.style.setProperty('--art-y',`${Math.max(-2.4,Math.min(2.4,((x-bounds.left)/bounds.width-.5)*4.8))}deg`);
    });
  },{passive:true});
  project.addEventListener('pointerleave',reset);document.addEventListener('experience-motion',reset);
});
