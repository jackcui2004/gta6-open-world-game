// The canvas renderer: the city, every entity, the HUD with its minimap, and the
// screens (title, pause, busted, wasted). The camera follows the player; the view is
// a fixed 1280x720 logical area scaled to the window. Everything is drawn with plain
// canvas shapes, no images and no network, so the game plays offline.

import { VIEW, WORLD, PALETTE, FONT, PLAYER, CAR } from './config.js';
import { ROAD_W, ROADS_V, ROADS_H } from './city.js';
import { missionObjective, missionTarget, missionTitle } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  }

  function viewTransform(camera, shakeX, shakeY) {
    const scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height) * camera.zoom;
    const ox = (canvas.width - VIEW.width * scale) / 2;
    const oy = (canvas.height - VIEW.height * scale) / 2;
    return { scale, ox, oy, shakeX, shakeY };
  }

  function worldToScreen(vt, x, y, camera) {
    return {
      x: vt.ox + (x - camera.x) * vt.scale + VIEW.width * vt.scale / 2 + vt.shakeX,
      y: vt.oy + (y - camera.y) * vt.scale + VIEW.height * vt.scale / 2 + vt.shakeY,
    };
  }

  function drawCity(state, vt, camera) {
    const city = state.city;
    const left = camera.x - VIEW.width / 2 / camera.zoom - 80;
    const top = camera.y - VIEW.height / 2 / camera.zoom - 80;
    const right = camera.x + VIEW.width / 2 / camera.zoom + 80;
    const bottom = camera.y + VIEW.height / 2 / camera.zoom + 80;
    const inView = (x, y, w, h) => x + w > left && x < right && y + h > top && y < bottom;

    // Ground.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(left, top, right - left, bottom - top);

    // Beach and sea on the east edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(2900, Math.max(top, 0), WORLD.width - 2900, Math.min(bottom, WORLD.height) - Math.max(top, 0));
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(3050, Math.max(top, 0), WORLD.width - 3050, Math.min(bottom, WORLD.height) - Math.max(top, 0));
    ctx.fillStyle = PALETTE.seaDeep;
    ctx.fillRect(3120, Math.max(top, 0), WORLD.width - 3120, Math.min(bottom, WORLD.height) - Math.max(top, 0));
    // Surf line.
    ctx.strokeStyle = '#ffffff88';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(3052, Math.max(top, 0));
    ctx.lineTo(3052, Math.min(bottom, WORLD.height));
    ctx.stroke();

    // Palma Park.
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(1055, 955, 490, 390);
    ctx.strokeStyle = '#00000022';
    ctx.lineWidth = 2;
    ctx.strokeRect(1055, 955, 490, 390);

    // Sidewalks: a pale strip along every road, under the asphalt.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_W / 2 - 18, Math.max(top, 0), ROAD_W + 36, Math.min(bottom, WORLD.height) - Math.max(top, 0));
    for (const ry of ROADS_H) ctx.fillRect(Math.max(left, 0), ry - ROAD_W / 2 - 18, Math.min(right, WORLD.width) - Math.max(left, 0), ROAD_W + 36);

    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_W / 2, Math.max(top, 0), ROAD_W, Math.min(bottom, WORLD.height) - Math.max(top, 0));
    for (const ry of ROADS_H) ctx.fillRect(Math.max(left, 0), ry - ROAD_W / 2, Math.min(right, WORLD.width) - Math.max(left, 0), ROAD_W);

    // Lane dashes.
    ctx.strokeStyle = PALETTE.roadLine;
    ctx.lineWidth = 4;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    for (const rx of ROADS_V) {
      ctx.moveTo(rx, Math.max(top, 0));
      ctx.lineTo(rx, Math.min(bottom, WORLD.height));
    }
    for (const ry of ROADS_H) {
      ctx.moveTo(Math.max(left, 0), ry);
      ctx.lineTo(Math.min(right, WORLD.width), ry);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Port containers.
    for (const c of city.containers) {
      if (!inView(c.x, c.y, c.w, c.h)) continue;
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = '#00000044';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x, c.y, c.w, c.h);
      ctx.beginPath();
      ctx.moveTo(c.x + c.w / 2, c.y);
      ctx.lineTo(c.x + c.w / 2, c.y + c.h);
      ctx.stroke();
    }

    // Buildings: roof colour, a darker edge, a rooftop box.
    for (const b of city.buildings) {
      if (!inView(b.x, b.y, b.w, b.h)) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#00000055';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#ffffff22';
      ctx.fillRect(b.x + 10, b.y + 10, Math.max(8, b.w - 20), Math.max(6, b.h / 4));
      ctx.fillStyle = '#00000033';
      ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.45, b.w * 0.2, b.h * 0.2);
    }

    // Trees and palms.
    for (const t of city.trees) {
      if (!inView(t.x - t.r, t.y - t.r, t.r * 2, t.r * 2)) continue;
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.treeLight;
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of city.palms) {
      if (!inView(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)) continue;
      ctx.strokeStyle = '#8b5e3c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + 8);
      ctx.lineTo(p.x, p.y - 6);
      ctx.stroke();
      ctx.fillStyle = PALETTE.palm;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 8, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Named places, small labels on the map.
    ctx.fillStyle = '#14213d';
    ctx.font = 'bold 15px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const labels = [
      [city.locations.garage, "Marty's Garage"],
      [city.locations.docks, 'Port Solmar'],
      [city.locations.bank, 'Solmar Bay Bank'],
      [city.locations.safehouse, 'Safehouse'],
      [city.locations.hospital, 'Solmar General'],
      [city.locations.policeStation, 'Solmar PD'],
      [city.locations.burger, 'Burger Barn'],
      [city.locations.beach, 'Solmar Beach'],
    ];
    for (const [loc, name] of labels) {
      if (!inView(loc.x - 60, loc.y - 40, 200, 40)) continue;
      const w = ctx.measureText(name).width + 12;
      ctx.fillStyle = '#ffffffcc';
      roundRect(ctx, loc.x - w / 2, loc.y - 58, w, 22, 6);
      ctx.fill();
      ctx.fillStyle = '#14213d';
      ctx.textAlign = 'center';
      ctx.fillText(name, loc.x, loc.y - 54);
      ctx.textAlign = 'left';
    }
  }

  function drawSkids(state) {
    ctx.strokeStyle = '#00000055';
    ctx.lineWidth = 5;
    for (const s of state.skids) {
      ctx.globalAlpha = Math.min(0.6, s.life);
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * 14, s.y - Math.sin(s.angle) * 14);
      ctx.lineTo(s.x + Math.cos(s.angle) * 14, s.y + Math.sin(s.angle) * 14);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawCar(car, isPlayer, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = '#00000033';
    roundRect(ctx, -CAR.length / 2 + 2, -CAR.width / 2 + 3, CAR.length, CAR.width, 8);
    ctx.fill();
    // Body.
    ctx.fillStyle = car.wreck ? '#2b2d42' : car.color;
    roundRect(ctx, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    ctx.fill();
    if (!car.wreck) {
      // Windshield and rear window.
      ctx.fillStyle = '#14213dcc';
      ctx.fillRect(6, -CAR.width / 2 + 4, 12, CAR.width - 8);
      ctx.fillRect(-18, -CAR.width / 2 + 4, 8, CAR.width - 8);
      // Roof.
      ctx.fillStyle = '#ffffff2e';
      ctx.fillRect(-8, -CAR.width / 2 + 5, 14, CAR.width - 10);
    }
    if (car.isPolice) {
      // Light bar, flashing red/blue.
      const phase = Math.floor(time * 6) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2e2e' : '#2e6bff';
      ctx.fillRect(-4, -CAR.width / 2 - 2, 8, 7);
      ctx.fillStyle = phase ? '#2e6bff' : '#ff2e2e';
      ctx.fillRect(-4, CAR.width / 2 - 5, 8, 7);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, -CAR.width / 2 - 8);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffd60a';
      ctx.lineWidth = 3;
      roundRect(ctx, -CAR.length / 2 - 4, -CAR.width / 2 - 4, CAR.length + 8, CAR.width + 8, 10);
      ctx.stroke();
    }
    ctx.restore();
    if (car.wreck || car.health < 40) {
      // Smoke from a dying car.
      ctx.fillStyle = '#6c757d88';
      ctx.beginPath();
      ctx.arc(car.x + Math.cos(car.angle) * -10, car.y + Math.sin(car.angle) * -10, 10 + Math.sin(time * 9) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPedestrian(ped, isPlayer) {
    if (ped.state === 'down') {
      // Lying flat.
      ctx.fillStyle = '#00000044';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y + 4, 16, 7, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 14, 8, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    // Shadow, body, head.
    ctx.fillStyle = '#00000033';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y + 10, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4d35e';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4 - 4, 6, 0, Math.PI * 2);
    ctx.fill();
    if (ped.kind === 'debtor') {
      ctx.fillStyle = '#ffd60a';
      ctx.font = 'bold 13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('LENNY', ped.x, ped.y - 24);
    }
    if (ped.kind === 'taxi') {
      ctx.fillStyle = '#70e000';
      ctx.font = 'bold 20px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('$', ped.x, ped.y - 24);
    }
    if (ped.kind === 'cop') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('PD', ped.x, ped.y - 18);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffd60a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 17, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPickups(state, time) {
    for (const pk of state.pickups) {
      if (!pk.active) continue;
      const bob = Math.sin(time * 4 + pk.x) * 2;
      if (pk.kind === 'cash') {
        ctx.fillStyle = '#70e000';
        ctx.beginPath();
        ctx.arc(pk.x, pk.y + bob, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#14213d';
        ctx.font = 'bold 14px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('$', pk.x, pk.y + bob + 5);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pk.x, pk.y + bob, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef233c';
        ctx.fillRect(pk.x - 7, pk.y + bob - 2, 14, 4);
        ctx.fillRect(pk.x - 2, pk.y + bob - 7, 4, 14);
      }
    }
  }

  function drawMissionMarker(state, time) {
    const target = missionTarget(state.mission, state);
    if (!target) return;
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    const x = target.x;
    const y = target.y - 30;
    // A beam of light so the target reads from far away.
    const grad = ctx.createLinearGradient(x, y - 220, x, y);
    grad.addColorStop(0, '#ffd60a00');
    grad.addColorStop(1, '#ffd60a66');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 14, y - 220, 28, 220);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = PALETTE.mission;
    ctx.fillRect(-12, -12, 24, 24);
    ctx.strokeStyle = '#14213d';
    ctx.lineWidth = 3;
    ctx.strokeRect(-12, -12, 24, 24);
    ctx.restore();
    ctx.fillStyle = '#14213d';
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(target.label, x, y + 22);
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawStars(state) {
    const x0 = canvas.width - 190;
    const y0 = 22;
    ctx.font = '28px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < state.wanted ? PALETTE.star : PALETTE.starEmpty;
      ctx.fillText('★', x0 + i * 34, y0);
    }
    if (state.wanted > 0) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 13px ' + FONT;
      ctx.fillText('WANTED', x0, y0 + 34);
    }
  }

  function drawMinimap(state) {
    const w = 216;
    const h = 162;
    const x0 = 18;
    const y0 = canvas.height - h - 18;
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    ctx.fillStyle = PALETTE.minimapBg;
    roundRect(ctx, x0 - 6, y0 - 6, w + 12, h + 12, 10);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, w, h);
    ctx.clip();
    // Sea and roads.
    ctx.fillStyle = PALETTE.minimapSea;
    ctx.fillRect(x0 + 3050 * sx, y0, (WORLD.width - 3050) * sx, h);
    ctx.strokeStyle = PALETTE.minimapRoad;
    ctx.lineWidth = 3;
    for (const rx of ROADS_V) {
      ctx.beginPath();
      ctx.moveTo(x0 + rx * sx, y0);
      ctx.lineTo(x0 + rx * sx, y0 + h);
      ctx.stroke();
    }
    for (const ry of ROADS_H) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 + ry * sy);
      ctx.lineTo(x0 + w, y0 + ry * sy);
      ctx.stroke();
    }
    // Mission target.
    const target = missionTarget(state.mission, state);
    if (target) {
      ctx.fillStyle = PALETTE.minimapMission;
      ctx.beginPath();
      ctx.arc(x0 + target.x * sx, y0 + target.y * sy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Taxi customer.
    for (const ped of state.pedestrians) {
      if (ped.kind === 'taxi') {
        ctx.fillStyle = PALETTE.minimapTaxi;
        ctx.beginPath();
        ctx.arc(x0 + ped.x * sx, y0 + ped.y * sy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Police.
    ctx.fillStyle = PALETTE.minimapPolice;
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      ctx.beginPath();
      ctx.arc(x0 + car.x * sx, y0 + car.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const px = x0 + state.player.x * sx;
    const py = y0 + state.player.y * sy;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.player.angle);
    ctx.fillStyle = PALETTE.minimapPlayer;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '11px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR BAY', x0, y0 - 18);
  }

  function drawHud(state, time) {
    // Top-left: money and health.
    ctx.fillStyle = PALETTE.hudBg;
    roundRect(ctx, 14, 14, 240, 74, 10);
    ctx.fill();
    ctx.fillStyle = '#70e000';
    ctx.font = 'bold 26px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('$' + state.money.toLocaleString('en-US'), 28, 22);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px ' + FONT;
    ctx.fillText('earned $' + state.earned.toLocaleString('en-US'), 28, 54);
    // Health bar.
    ctx.fillStyle = '#00000088';
    roundRect(ctx, 28, 70, 150, 10, 5);
    ctx.fill();
    ctx.fillStyle = state.health > 30 ? PALETTE.health : PALETTE.healthLow;
    roundRect(ctx, 28, 70, Math.max(4, 150 * (state.health / 100)), 10, 5);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = '11px ' + FONT;
    ctx.fillText('HP ' + Math.ceil(state.health), 186, 68);

    drawStars(state);

    // Top-centre: mission title and objective.
    const title = missionTitle(state.mission);
    const objective = missionObjective(state.mission, state);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.toast;
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillText(title, canvas.width / 2, 16);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '15px ' + FONT;
    ctx.fillText(objective, canvas.width / 2, 44);

    // Speed, when driving.
    const car = state.player.car === -1 ? null : state.cars[state.player.car];
    if (car && !state.player.onFoot) {
      const mph = Math.round(car.speed * 0.12);
      ctx.fillStyle = PALETTE.hudBg;
      roundRect(ctx, canvas.width - 128, canvas.height - 64, 110, 46, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 26px ' + FONT;
      ctx.textAlign = 'right';
      ctx.fillText(String(mph), canvas.width - 52, canvas.height - 56);
      ctx.font = '12px ' + FONT;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('MPH', canvas.width - 26, canvas.height - 50);
    }

    // Toasts.
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px ' + FONT;
    let ty = 84;
    for (const t of state.toasts) {
      ctx.globalAlpha = Math.min(1, t.ttl);
      ctx.fillStyle = '#00000088';
      const w = ctx.measureText(t.text).width + 24;
      roundRect(ctx, canvas.width / 2 - w / 2, ty - 4, w, 28, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.toast;
      ctx.fillText(t.text, canvas.width / 2, ty + 2);
      ty += 34;
    }
    ctx.globalAlpha = 1;

    drawMinimap(state);

    // Controls hint, bottom centre.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(
      state.player.onFoot
        ? 'WASD move · Shift run · E steal car · Space punch · T taxi · P pause · M mute'
        : 'WASD drive · E leave car · P pause · M mute',
      canvas.width / 2,
      canvas.height - 26,
    );
  }

  function drawButton(id, label, x, y, w, h, primary) {
    ctx.fillStyle = primary ? '#e63946' : '#14213dcc';
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = primary ? '#ffd60a' : '#ffffff55';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 10);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.textBaseline = 'top';
    return { id, x, y, w, h };
  }

  function drawTitle(state, best, saveExists) {
    // Dim the city behind the menu.
    ctx.fillStyle = '#14213d99';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd60a';
    ctx.font = 'bold 84px ' + FONT;
    ctx.fillText('SOLMAR BAY', canvas.width / 2, canvas.height * 0.16);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '24px ' + FONT;
    ctx.fillText('An open-world crime story — steal cars, run jobs, lose the cops.', canvas.width / 2, canvas.height * 0.16 + 96);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '16px ' + FONT;
    ctx.fillText('You are Rico Vale, a driver-for-hire. Marty has work — if you have wheels.', canvas.width / 2, canvas.height * 0.16 + 130);
    const buttons = [];
    const bw = 280;
    const bh = 52;
    const bx = canvas.width / 2 - bw / 2;
    let by = canvas.height * 0.48;
    if (saveExists) {
      buttons.push(drawButton('continue', 'Continue', bx, by, bw, bh, true));
      by += 66;
    }
    buttons.push(drawButton('new', saveExists ? 'New Game' : 'Start Game', bx, by, bw, bh, !saveExists));
    by += 66;
    buttons.push(drawButton('how', 'How to Play', bx, by, bw, bh, false));
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '14px ' + FONT;
    ctx.fillText('WASD move / drive · E enter or leave a car · Space punch · Shift run · P pause · M mute', canvas.width / 2, by + 76);
    ctx.fillText('Missions pay cash. Wanted stars bring the Solmar PD. Lose them to go clean.', canvas.width / 2, by + 100);
    if (best > 0) ctx.fillText('Best haul so far: $' + best.toLocaleString('en-US'), canvas.width / 2, by + 124);
    return buttons;
  }

  function drawHowTo() {
    ctx.fillStyle = '#14213dee';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd60a';
    ctx.font = 'bold 40px ' + FONT;
    ctx.fillText('How to Play', canvas.width / 2, 90);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '18px ' + FONT;
    const lines = [
      'You are Rico Vale. Marty the fixer has five jobs for you — finish them all to rule Solmar Bay.',
      '',
      'ON FOOT: WASD or arrows to walk, Shift to run, Space to punch, E to steal a nearby car.',
      'DRIVING: W accelerates, S brakes and reverses, A and D steer. E leaves the car.',
      'WANTED: stealing cars, hitting pedestrians and punching people raise your stars.',
      'The Solmar PD chases you — ram them back or stay clean until the stars fade.',
      'BUSTED: a cop car sits on you on foot and you lose 12% of your cash.',
      'WASTED: your health hits zero and you wake up at Solmar General, 12% lighter.',
      'TAXI: after your first job, press T in a car near a green $ customer for a fare.',
      'PICKUPS: green $ is cash, the white cross heals. Your progress saves automatically.',
      'P pauses, M mutes. The game runs offline, from its own files.',
    ];
    let y = 170;
    for (const line of lines) {
      ctx.fillText(line, canvas.width / 2, y);
      y += 34;
    }
    const buttons = [drawButton('back', 'Back', canvas.width / 2 - 140, y + 20, 280, 52, true)];
    return buttons;
  }

  function drawPaused() {
    ctx.fillStyle = '#14213dbb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 56px ' + FONT;
    ctx.fillText('Paused', canvas.width / 2, canvas.height * 0.3);
    const buttons = [];
    const bw = 280;
    const bh = 52;
    const bx = canvas.width / 2 - bw / 2;
    buttons.push(drawButton('resume', 'Resume', bx, canvas.height * 0.44, bw, bh, true));
    buttons.push(drawButton('restart', 'Restart Mission', bx, canvas.height * 0.44 + 66, bw, bh, false));
    buttons.push(drawButton('quit', 'Quit to Title', bx, canvas.height * 0.44 + 132, bw, bh, false));
    return buttons;
  }

  function drawEnd(kind, lost) {
    ctx.fillStyle = kind === SCREEN_BUSTED ? '#1d3557ee' : '#6d1a1aee';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px ' + FONT;
    ctx.fillText(kind === SCREEN_BUSTED ? 'BUSTED!' : 'WASTED', canvas.width / 2, canvas.height * 0.32);
    ctx.font = '20px ' + FONT;
    ctx.fillText(
      kind === SCREEN_BUSTED
        ? `The Solmar PD caught you — you lost $${lost.toLocaleString('en-US')}.`
        : `You woke up at Solmar General — $${lost.toLocaleString('en-US')} lighter.`,
      canvas.width / 2,
      canvas.height * 0.32 + 70,
    );
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '16px ' + FONT;
    ctx.fillText('Press Enter or click to get back on the streets.', canvas.width / 2, canvas.height * 0.32 + 108);
    return [drawButton('continue', 'Back to the Streets', canvas.width / 2 - 140, canvas.height * 0.52, 280, 52, true)];
  }

  /**
   * Paint the world and the HUD for `screen`, and return the buttons on that screen
   * (each {id, x, y, w, h} in canvas pixels) for the main loop's click handling.
   */
  function draw(state, screen, extra) {
    resize();
    const time = state.time;
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const vt = viewTransform(state.camera, shakeX, shakeY);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(vt.scale, 0, 0, vt.scale, vt.ox + VIEW.width * vt.scale / 2 - state.camera.x * vt.scale + shakeX, vt.oy + VIEW.height * vt.scale / 2 - state.camera.y * vt.scale + shakeY);
    drawCity(state, vt, state.camera);
    drawSkids(state);
    drawMissionMarker(state, time);
    drawPickups(state, time);
    for (const car of state.cars) {
      if (car === state.cars[state.player.car]) continue;
      drawCar(car, false, time);
    }
    const playerCar = state.player.car === -1 ? null : state.cars[state.player.car];
    if (playerCar && !state.player.onFoot) drawCar(playerCar, true, time);
    for (const ped of state.pedestrians) drawPedestrian(ped, false);
    if (state.player.onFoot) {
      drawPedestrian(
        { x: state.player.x, y: state.player.y, angle: state.player.angle, state: 'walk', shirt: '#e63946', kind: 'player' },
        true,
      );
    }
    drawParticles(state);
    // Back to screen space for the HUD and the screens.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (screen === SCREEN_PLAY) {
      drawHud(state, time);
      return [];
    }
    if (screen === SCREEN_TITLE) {
      drawHud(state, time);
      if (extra.showHow) return drawHowTo();
      return drawTitle(state, extra.best || 0, extra.saveExists || false);
    }
    if (screen === SCREEN_PAUSED) {
      drawHud(state, time);
      return drawPaused();
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      drawHud(state, time);
      return drawEnd(screen, extra.lost || 0);
    }
    return [];
  }

  return { draw, resize };
}
