import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {AdSlot} from '../src/App';
import type {Ad} from '../src/data';

const base:Ad={id:'a',business:'A',title:'A',description:'A',category:'Services',location:'Here',accent:'blue',status:'Approved',active:true,startsAt:'2026-10-01T00:00:00Z',endsAt:'2026-10-31T23:59:59Z',placements:['home-top'],priority:1};
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;

describe('AdSlot rotation timing',()=>{
  afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();document.body.innerHTML=''});

   it('rotates when a visible slot is partly below the fold',async()=>{
     vi.useFakeTimers();
     vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
     vi.stubGlobal('IntersectionObserver',class {constructor(private callback:(entries:Array<{isIntersecting:boolean;intersectionRatio:number}>)=>void,private options?:{threshold?:number[]}){}observe(){if((this.options?.threshold?.[0]||0)<=.2)this.callback([{isIntersecting:true,intersectionRatio:.2}])}disconnect(){}});
     const container=document.createElement('div'); document.body.append(container); const root=createRoot(container);
     const ads=[base,{...base,id:'b',business:'B'}];
     await act(async()=>{root.render(<AdSlot ads={ads} placement="home-top" open={()=>{}}/>)});
     expect(container.textContent).toContain('1 of 2');
     await act(async()=>{vi.advanceTimersByTime(15_000)});
     expect(container.textContent).toContain('2 of 2');
     await act(async()=>{root.unmount()});
   });

   it('starts observing after async inventory makes the slot render',async()=>{
     vi.useFakeTimers();
     vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
     vi.stubGlobal('IntersectionObserver',class {constructor(private callback:(entries:Array<{isIntersecting:boolean;intersectionRatio:number}>)=>void){}observe(){this.callback([{isIntersecting:true,intersectionRatio:.5}])}disconnect(){}});
     const container=document.createElement('div'); document.body.append(container); const root=createRoot(container);
     await act(async()=>{root.render(<AdSlot ads={[]} placement="home-top" open={()=>{}}/>)});
     await act(async()=>{root.render(<AdSlot ads={[base,{...base,id:'b',business:'B'}]} placement="home-top" open={()=>{}}/>)});
     await act(async()=>{vi.advanceTimersByTime(15_000)});
     expect(container.textContent).toContain('2 of 2');
     await act(async()=>{root.unmount()});
   });

   it('keeps the original interval after a manual advance',async()=>{
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
    vi.stubGlobal('IntersectionObserver',class {constructor(private callback:(entries:Array<{isIntersecting:boolean;intersectionRatio:number}>)=>void){}observe(){this.callback([{isIntersecting:true,intersectionRatio:1}])}disconnect(){}});
    const container=document.createElement('div'); document.body.append(container); const root=createRoot(container);
    const ads=[base,{...base,id:'b',business:'B'},{...base,id:'c',business:'C'}];
    await act(async()=>{root.render(<AdSlot ads={ads} placement="home-top" open={()=>{}}/>)});
    const next=()=>container.querySelector('button') as HTMLButtonElement;
    expect(container.textContent).toContain('1 of 3');
    await act(async()=>{vi.advanceTimersByTime(10_000); next().click()});
    expect(container.textContent).toContain('2 of 3');
    await act(async()=>{vi.advanceTimersByTime(4_999)});
    expect(container.textContent).toContain('2 of 3');
    await act(async()=>{vi.advanceTimersByTime(1)});
    expect(container.textContent).toContain('3 of 3');
    await act(async()=>{root.unmount()});
  });
});
