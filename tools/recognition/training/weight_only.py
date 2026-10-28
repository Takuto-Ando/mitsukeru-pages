"""Compress Conv/Gemm/MatMul weights; retain FP32 activations and compute."""
import argparse
import hashlib
import json
from pathlib import Path


def convert(source, output):
    import numpy as np
    import onnx
    from onnx import helper, numpy_helper
    source, output = Path(source), Path(output)
    if output.exists():
        raise FileExistsError(output)
    model = onnx.load(source)
    weights = {tensor.name: tensor for tensor in model.graph.initializer}
    targets = {}
    for node in model.graph.node:
        if node.op_type not in ('Conv', 'Gemm', 'MatMul') or len(node.input) < 2 or node.input[1] not in weights:
            continue
        name = node.input[1]
        axis = 0
        if node.op_type == 'Gemm':
            transposed = next((attr.i for attr in node.attribute if attr.name == 'transB'), 0)
            axis = 0 if transposed else 1
        elif node.op_type == 'MatMul':
            axis = len(weights[name].dims) - 1
        if name in targets and targets[name] != axis:
            raise ValueError('Shared weight with conflicting quantization axes')
        targets[name] = axis
    occupied = set(weights) | {name for node in model.graph.node for name in node.output}
    inputs = {value.name for value in model.graph.input}
    added_weights, prefix_nodes, compressed = [], [], []
    for name, axis in targets.items():
        values = numpy_helper.to_array(weights[name])
        if values.dtype != np.float32 or values.ndim < 2:
            continue
        if name in inputs or not np.isfinite(values).all():
            raise ValueError('Expected finite constant weights')
        reduce_axes = tuple(i for i in range(values.ndim) if i != axis)
        scale = np.max(np.abs(values), axis=reduce_axes) / np.float32(127)
        scale = np.where(scale > 0, scale, np.float32(1)).astype(np.float32)
        shape = [1] * values.ndim
        shape[axis] = len(scale)
        quantized = np.clip(np.rint(values / scale.reshape(shape)), -127, 127).astype(np.int8)
        names = [name + '__zooketch_' + suffix for suffix in ('int8', 'scale', 'zero')]
        if any(value in occupied for value in names):
            raise ValueError('Generated tensor name collision')
        occupied.update(names)
        added_weights.extend([numpy_helper.from_array(quantized, names[0]),
                              numpy_helper.from_array(scale, names[1]),
                              numpy_helper.from_array(np.zeros_like(scale, dtype=np.int8), names[2])])
        prefix_nodes.append(helper.make_node('DequantizeLinear', names, [name], axis=axis))
        compressed.append(name)
    if not compressed:
        raise ValueError('No supported FP32 weights found')
    kept = [tensor for tensor in model.graph.initializer if tensor.name not in compressed]
    del model.graph.initializer[:]
    model.graph.initializer.extend(kept + added_weights)
    original_nodes = list(model.graph.node)
    del model.graph.node[:]
    model.graph.node.extend(prefix_nodes + original_nodes)
    onnx.checker.check_model(model)
    onnx.save(model, output)
    return {'kind': 'weight-only-int8-fp32-compute', 'compressedTensors': len(compressed),
            'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest(),
            'sourceBytes': source.stat().st_size, 'outputBytes': output.stat().st_size,
            'calibrationPhotosUsed': False,
            'note': 'Download compression only. Runtime may expand weights to FP32; memory reduction is not guaranteed.'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('output')
    args = parser.parse_args()
    report = convert(args.source, args.output)
    Path(args.output + '.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
