// Componente de la pieza 2 - Pediatrics
// Extraído de Figma usando MCP

const imgLock2 = "http://localhost:3845/assets/04dced0dfa2b4a46ced43ba1a02f25fe5caa4936.png";
const imgGroup = "http://localhost:3845/assets/a31941f71e0afd4ad86da19c4652ef3a37d340aa.svg";
const imgGroup1 = "http://localhost:3845/assets/ddf4ea253164a9fd74b808a775a48824ee59ae83.svg";
const imgGroup2 = "http://localhost:3845/assets/d0473d9e96c7117728b0fd660957fe7a2adf9975.svg";
const imgGroup3 = "http://localhost:3845/assets/0145c7d75599089b218ac4d3ece30e4910fe0b3a.svg";
const imgGroup4 = "http://localhost:3845/assets/a5369d04fe2f503b24cde0e70cd2b715de997f10.svg";
const imgGroup5 = "http://localhost:3845/assets/e73f73003b12cd7ebfe4c19aa490e328b528c9fe.svg";
const imgVector = "http://localhost:3845/assets/2c3f6e193e76f424e31f656b2f08782078cbfdd7.svg";
const imgGroup6 = "http://localhost:3845/assets/b139364e751979ea255dd901b94cf6f46cb4df7d.svg";
const imgGroup7 = "http://localhost:3845/assets/5255fca9829ac5b574b4db5c0a367fd94adcfb38.svg";
const imgGroup8 = "http://localhost:3845/assets/c20a0f6bef85d32870b3f44648214c06b1e72c4f.svg";
const imgVector1 = "http://localhost:3845/assets/5c29c393fbf81c9f1b8cbee9f5ac0f67776cdc89.svg";
const imgPediatrics = "http://localhost:3845/assets/ee54cc4b8ae1b87fe52e06c3e7551392f4bc2501.svg";
const imgGroup9 = "http://localhost:3845/assets/9c065b4e0e16aa314e07f1910c94a1645a8c89ef.svg";
const imgGroup10 = "http://localhost:3845/assets/f1fbaa83ad8feebd0c5ed9e8ce8cd137e768cc9b.svg";
const imgVector2 = "http://localhost:3845/assets/e3e3953eaf33759c784966b852e6385b95d193ab.svg";
const imgVector3 = "http://localhost:3845/assets/3abe094ea06692f74c80bcc977656fd353693747.svg";
const imgVector4 = "http://localhost:3845/assets/451c81b5e62b3ba11e6ab12f0cc892fd1b4a5f7d.svg";
const imgGroup11 = "http://localhost:3845/assets/216dd72c5a84929dc999ab58614fdd02007b7a27.svg";
const imgGroup12 = "http://localhost:3845/assets/d83a31a1bd57ae1340f1b7ebc3cb93587e758197.svg";
const imgGroup13 = "http://localhost:3845/assets/850e39c2a75cbaae0010b11d0091832c274a7fe1.svg";
const imgGroup14 = "http://localhost:3845/assets/787a690bba83139d54bf2b6d397a88759382621f.svg";
const imgGroup15 = "http://localhost:3845/assets/5a65352cb7e8c291c6aee92d761a976cad8713da.svg";
const imgGroup16 = "http://localhost:3845/assets/e6c11e9c40798440af117f6a9650615c263438b3.svg";
const imgGroup17 = "http://localhost:3845/assets/18b38a22d6466b4c0520037e90c74e554b8b0173.svg";
const imgGroup18 = "http://localhost:3845/assets/99d7f26d7929508bf2df6b9b6e0aaf0cc0878664.svg";
const imgGroup19 = "http://localhost:3845/assets/5d5f4509ebf574a7b0989e3d586473f7418f9577.svg";
const imgGroup20 = "http://localhost:3845/assets/3d6b7219005b5bdf0f2e0fc94d610dd0370b1efb.svg";
const imgGroup21 = "http://localhost:3845/assets/a54fc3b026ad04776cdee5337b0fd8e63f51d804.svg";
const imgGroup22 = "http://localhost:3845/assets/75f16a5749bf89596fe6af25fb62a0b4f1af2698.svg";
const imgGroup23 = "http://localhost:3845/assets/e0537c3cebcbe6f5a5d7291d3e3a840cee4bdd0d.svg";
const imgGroup24 = "http://localhost:3845/assets/7f4b0076e45f3fc51f49823ceb55be34a3ecc1d3.svg";
const imgGroup25 = "http://localhost:3845/assets/a67ef168d905269e593f012f3667bbf8f9ba4080.svg";
const imgGroup26 = "http://localhost:3845/assets/a84f263940e2b4125d754156198054d0c7a6d04c.svg";
const imgVector5 = "http://localhost:3845/assets/ebe0447e345df365d5347f465be866863f7e05a6.svg";

function createPediatricsComponent(isLocked = false) {
  if (isLocked) {
    return `
      <div class="piece-locked" style="
        width: 100%;
        height: 100%;
        background: #35d3d3;
        display: flex;
        justify-content: center;
        align-items: center;
        border: 3px solid #143940;
        border-radius: 15px;
        position: relative;
      ">
        <div style="
          width: 60px;
          height: 60px;
          background: url('${imgLock2}') center/cover;
        "></div>
      </div>
    `;
  }
  
  return `
    <div class="piece-unlocked" style="
      width: 100%;
      height: 100%;
      position: relative;
      background: linear-gradient(45deg, #35d3d3, #4dd4d4);
      border-radius: 15px;
      overflow: hidden;
    ">
      <!-- Pediatrics piece content -->
      <div style="
        position: absolute;
        inset: 5%;
        background: url('${imgPediatrics}') center/contain no-repeat;
      "></div>
      <div style="
        position: absolute;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        color: #004249;
        font-family: 'Poppins', sans-serif;
        font-weight: bold;
        font-size: 12px;
        text-align: center;
      ">
        Pediatrics
      </div>
    </div>
  `;
}

// Registrar el componente globalmente
window.PediatricsComponent = {
  locked: () => createPediatricsComponent(true),
  unlocked: () => createPediatricsComponent(false)
};
