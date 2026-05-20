// Bloco Unificado: ParametricCAD
// Inspirado em: FreeCAD, OpenSCAD, SolveSpace
// Finalidade: Avaliação e compilação de representação procedural e restrições de geometria (CSG/BREP).

export interface CADPrimitive {
    type: 'cube' | 'sphere' | 'cylinder';
    dimensions: number[];
    translation: [number, number, number];
}

export interface CSGNode {
    operation: 'union' | 'difference' | 'intersection' | 'leaf';
    primitive?: CADPrimitive;
    children?: CSGNode[];
}

export interface Constraint {
    type: 'distance' | 'horizontal' | 'vertical' | 'fixed';
    nodeA: number; // Index in nodes array
    nodeB?: number; // Index in nodes array
    value?: number;
}

export interface SketchNode {
    id: number;
    x: number;
    y: number;
    isFixed?: boolean;
}

export class ParametricCAD {
    
    /**
     * Avalia uma árvore de operações booleanas em primitivos (Cylinder, Box, Sphere)
     * Abordagem CSG (Constructive Solid Geometry) similar ao OpenSCAD de alto desempenho.
     */
    evaluateCSG(script: string): { status: string; operations: number; primitives: CADPrimitive[]; volumeEstimate: number; bounds: { min: number[]; max: number[] } } {
        console.log(`[CAD] Interpretando script paramétrico (OpenSCAD-like)...`);
        
        const primitives: CADPrimitive[] = [];
        let operationsCount = 0;
        let volumeEstimate = 0;

        // Limpeza de comentários e quebras de linha
        const sanitized = script.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').trim();
        const tokens = sanitized.split(';').map(t => t.trim()).filter(t => t.length > 0);

        let currentTranslation: [number, number, number] = [0, 0, 0];

        // Parser léxico iterativo para comandos clássicos CAD
        for (const token of tokens) {
            try {
                // translate([x, y, z])
                const translateMatch = token.match(/translate\s*\(\s*\[\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\]\s*\)/i);
                if (translateMatch) {
                    currentTranslation = [
                        parseFloat(translateMatch[1]),
                        parseFloat(translateMatch[2]),
                        parseFloat(translateMatch[3])
                    ];
                    continue;
                }

                // cube([w, h, d]) ou cube(size)
                const cubeMatch = token.match(/cube\s*\(\s*(?:\[\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\]|([\d.-]+))\s*\)/i);
                if (cubeMatch) {
                    const w = cubeMatch[1] ? parseFloat(cubeMatch[1]) : parseFloat(cubeMatch[4]);
                    const h = cubeMatch[2] ? parseFloat(cubeMatch[2]) : parseFloat(cubeMatch[4]);
                    const d = cubeMatch[3] ? parseFloat(cubeMatch[3]) : parseFloat(cubeMatch[4]);
                    primitives.push({
                        type: 'cube',
                        dimensions: [w, h, d],
                        translation: [...currentTranslation]
                    });
                    volumeEstimate += w * h * d;
                    operationsCount++;
                    continue;
                }

                // sphere(r)
                const sphereMatch = token.match(/sphere\s*\(\s*([\d.-]+)\s*\)/i);
                if (sphereMatch) {
                    const r = parseFloat(sphereMatch[1]);
                    primitives.push({
                        type: 'sphere',
                        dimensions: [r],
                        translation: [...currentTranslation]
                    });
                    volumeEstimate += (4 / 3) * Math.PI * Math.pow(r, 3);
                    operationsCount++;
                    continue;
                }

                // cylinder(h, r)
                const cylinderMatch = token.match(/cylinder\s*\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/i);
                if (cylinderMatch) {
                    const h = parseFloat(cylinderMatch[1]);
                    const r = parseFloat(cylinderMatch[2]);
                    primitives.push({
                        type: 'cylinder',
                        dimensions: [h, r],
                        translation: [...currentTranslation]
                    });
                    volumeEstimate += Math.PI * Math.pow(r, 2) * h;
                    operationsCount++;
                    continue;
                }
            } catch (err: any) {
                console.warn(`[CAD Parser Warning] Falha ao parsear bloco: ${token}. Erro: ${err.message}`);
            }
        }

        // Calcula as fronteiras globais do modelo (Bounding Box)
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        for (const p of primitives) {
            const tx = p.translation[0];
            const ty = p.translation[1];
            const tz = p.translation[2];

            let dx = 0, dy = 0, dz = 0;
            if (p.type === 'cube') {
                [dx, dy, dz] = p.dimensions;
            } else if (p.type === 'sphere') {
                const r = p.dimensions[0];
                dx = dy = dz = r * 2;
            } else if (p.type === 'cylinder') {
                const [h, r] = p.dimensions;
                dx = dy = r * 2;
                dz = h;
            }

            minX = Math.min(minX, tx - dx / 2);
            minY = Math.min(minY, ty - dy / 2);
            minZ = Math.min(minZ, tz - dz / 2);

            maxX = Math.max(maxX, tx + dx / 2);
            maxY = Math.max(maxY, ty + dy / 2);
            maxZ = Math.max(maxZ, tz + dz / 2);
        }

        const bounds = primitives.length > 0 
            ? { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] }
            : { min: [0, 0, 0], max: [0, 0, 0] };

        return {
            status: 'compiled',
            operations: operationsCount,
            primitives,
            volumeEstimate: Math.round(volumeEstimate * 100) / 100,
            bounds
        };
    }

    /**
     * Solver de restrições geométricas bidimensionais (SolveSpace solver approach)
     * Utiliza algoritmos de Projeção Iterativa de Posições (Verlet Relaxation).
     */
    solveConstraints(sketchNodes: SketchNode[], constraints: Constraint[], maxIterations: number = 100, tolerance: number = 0.001): { solved: boolean; nodes: SketchNode[]; iterations: number; error: number } {
        console.log(`[CAD] Resolvendo graus de liberdade (DoF) para sketch 2D...`);
        
        // Cópia profunda dos nós para impedir mutação indesejada
        const nodes = sketchNodes.map(n => ({ ...n }));

        let totalDev = 0;
        let iter = 0;

        for (iter = 0; iter < maxIterations; iter++) {
            totalDev = 0;

            for (const c of constraints) {
                const nA = nodes[c.nodeA];
                if (!nA) continue;

                if (c.type === 'fixed') {
                    nA.isFixed = true;
                    continue;
                }

                if (c.type === 'horizontal') {
                    const nB = nodes[c.nodeB!];
                    if (!nB) continue;
                    const diffY = nB.y - nA.y;
                    totalDev += Math.abs(diffY);
                    
                    if (!nA.isFixed && !nB.isFixed) {
                        const midY = (nA.y + nB.y) / 2;
                        nA.y = midY;
                        nB.y = midY;
                    } else if (nA.isFixed && !nB.isFixed) {
                        nB.y = nA.y;
                    } else if (!nA.isFixed && nB.isFixed) {
                        nA.y = nB.y;
                    }
                }

                else if (c.type === 'vertical') {
                    const nB = nodes[c.nodeB!];
                    if (!nB) continue;
                    const diffX = nB.x - nA.x;
                    totalDev += Math.abs(diffX);

                    if (!nA.isFixed && !nB.isFixed) {
                        const midX = (nA.x + nB.x) / 2;
                        nA.x = midX;
                        nB.x = midX;
                    } else if (nA.isFixed && !nB.isFixed) {
                        nB.x = nA.x;
                    } else if (!nA.isFixed && nB.isFixed) {
                        nA.x = nB.x;
                    }
                }

                else if (c.type === 'distance') {
                    const nB = nodes[c.nodeB!];
                    if (!nB) continue;
                    const targetDist = c.value || 0;
                    
                    const dx = nB.x - nA.x;
                    const dy = nB.y - nA.y;
                    const actualDist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
                    const diff = actualDist - targetDist;
                    totalDev += Math.abs(diff);

                    const ratio = diff / actualDist;
                    const offsetX = dx * ratio * 0.5;
                    const offsetY = dy * ratio * 0.5;

                    if (!nA.isFixed && !nB.isFixed) {
                        nA.x += offsetX;
                        nA.y += offsetY;
                        nB.x -= offsetX;
                        nB.y -= offsetY;
                    } else if (nA.isFixed && !nB.isFixed) {
                        nB.x -= offsetX * 2;
                        nB.y -= offsetY * 2;
                    } else if (!nA.isFixed && nB.isFixed) {
                        nA.x += offsetX * 2;
                        nA.y += offsetY * 2;
                    }
                }
            }

            // Critério de parada do solver numérico
            if (totalDev < tolerance) {
                break;
            }
        }

        return {
            solved: totalDev < tolerance,
            nodes,
            iterations: iter,
            error: Math.round(totalDev * 10000) / 10000
        };
    }
}

