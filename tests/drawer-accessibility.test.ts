import {applyDrawerSemantics} from '../src/App';

describe('newspaper drawer semantics',()=>{
  const setup=()=>{
    const rail=document.createElement('aside');
    const background=[document.createElement('header'),document.createElement('main')];
    background.forEach(element=>document.body.append(element));
    return {rail,background};
  };

  it('keeps the desktop sidebar as an aside landmark, not a modal',()=>{
    const {rail,background}=setup();
    rail.setAttribute('role','dialog');
    rail.setAttribute('aria-modal','true');
    applyDrawerSemantics(rail,background,false,false);
    expect(rail.getAttribute('role')).toBeNull();
    expect(rail.getAttribute('aria-modal')).toBeNull();
    expect(rail.getAttribute('aria-hidden')).toBeNull();
    expect(rail.inert).toBe(false);
    expect(background[0].getAttribute('aria-hidden')).toBeNull();
    expect(background[0].inert).toBe(false);
  });

  it('uses modal semantics and inert background only for an open mobile drawer',()=>{
    const {rail,background}=setup();
    applyDrawerSemantics(rail,background,true,true);
    expect(rail.getAttribute('role')).toBe('dialog');
    expect(rail.getAttribute('aria-modal')).toBe('true');
    expect(rail.inert).toBe(false);
    expect(background[0].getAttribute('aria-hidden')).toBe('true');
    expect(background[0].inert).toBe(true);

    applyDrawerSemantics(rail,background,true,false);
    expect(rail.getAttribute('role')).toBeNull();
    expect(rail.getAttribute('aria-modal')).toBeNull();
    expect(rail.getAttribute('aria-hidden')).toBe('true');
    expect(rail.inert).toBe(true);
    expect(background[0].getAttribute('aria-hidden')).toBeNull();
    expect(background[0].inert).toBe(false);
  });
});
