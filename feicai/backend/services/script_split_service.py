"""剧本分集检测服务
四层检测机制 + 置信度判定 + 辅助验证
"""

import re
import statistics
from typing import List, Optional, Tuple
from pathlib import Path

from schemas.script_management_schema import (
    DetectionLayer,
    EpisodeSplitResult,
    SplitDetectionResponse,
)


# 检测置信度权重
LAYER_CONFIDENCE = {
    DetectionLayer.explicit_marker: 95,
    DetectionLayer.scene_title: 80,
    DetectionLayer.blank_line: 60,
    DetectionLayer.content_structure: 50,
}


def detect_explicit_markers(content: str) -> List[Tuple[int, int, str]]:
    """第一层：显式标记检测

    检测 EP01、第1集、Episode 1、第一集 等显式标记
    优先检测标题行的标记（行首或有括号包围）
    返回分割点位置列表: [(起始位置, 结束位置, 匹配文本)]
    """
    # 优先级高的格式（更精确，置信度更高）
    primary_patterns = [
        # 括号包围格式（最精确）
        r'\【第\s*[一二三四五六七八九十百零]+\s*集\】',  # 【第一集】
        r'\【第\s*\d+\s*集\】',                           # 【第1集】
        r'\（第\s*[一二三四五六七八九十百零]+\s*集\）',  # （第一集）
        r'\（第\s*\d+\s*集\）',                           # （第1集）
        r'\[第\s*[一二三四五六七八九十百零]+\s*集\]',    # [第一集]
        r'\[第\s*\d+\s*集\]',                             # [第1集]
        # 行首格式（标题行）
        r'^第\s*[一二三四五六七八九十百零]+\s*集\s*[：:\n]',  # 第一集： 或 第一集\n
        r'^第\s*\d+\s*集\s*[：:\n]',                         # 第1集： 或 第1集\n
        r'^EP\s*\d+\s*[：:\n]',                              # EP01： 或 EP01\n
        r'^Episode\s*\d+\s*[：:\n]',                          # Episode 1：
        r'^EPISODE\s*\d+\s*[：:\n]',                          # EPISODE 1：
    ]

    # 次级格式（需要验证）
    secondary_patterns = [
        # 中文格式（非行首时可能是内容中的文字）
        r'第\s*[一二三四五六七八九十百零]+\s*集',
        r'第\s*\d+\s*集',
        # 英文格式
        r'EP\s*\d+',
        r'Episode\s*\d+',
        r'EPISODE\s*\d+',
        # 纯数字格式（需要验证上下文）
        r'^\s*\d+\s*[\.．]\s+',                    # 1.、2.（行开头）
        r'^\s*\d{2}\s*\n',                         # 01、02（单独一行）
        # 结束标记
        r'本集\s*完',
        r'下集\s*预告',
    ]

    matches = []

    # 先检测高优先级格式
    for pattern in primary_patterns:
        for m in re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE):
            matches.append((m.start(), m.end(), m.group()))

    # 如果高优先级格式找到了足够多的标记，直接使用
    # 否则使用次级格式补充
    if len(matches) < 2:
        for pattern in secondary_patterns:
            for m in re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE):
                matches.append((m.start(), m.end(), m.group()))

    # 去重：重叠位置的多个匹配，只保留最长的
    if matches:
        # 按起始位置排序，长度降序
        matches.sort(key=lambda x: (x[0], -x[1]))

        unique_matches = []
        for match in matches:
            start, end, marker = match
            # 检查是否与已有匹配重叠
            is_duplicate = False
            for existing in unique_matches:
                ex_start, ex_end, ex_marker = existing
                # 如果当前匹配与已有匹配重叠，保留更长的
                if start >= ex_start and end <= ex_end:
                    # 当前匹配被已有匹配包含，跳过
                    is_duplicate = True
                    break
                elif start <= ex_start and end >= ex_end:
                    # 当前匹配包含已有匹配，替换
                    unique_matches.remove(existing)
                    break
                elif start < ex_end and end > ex_start:
                    # 部分重叠，保留位置靠前且更长的
                    if start < ex_start or (start == ex_start and end > ex_end):
                        unique_matches.remove(existing)
                        break

            if not is_duplicate:
                unique_matches.append(match)

        matches = unique_matches

    # 按位置排序
    matches.sort(key=lambda x: x[0])
    return matches


def detect_scene_titles(content: str) -> List[Tuple[int, int, str]]:
    """第二层：场景标题检测

    检测 场景一、SCENE 1、场景：XXX 等模式
    """
    patterns = [
        r'场景\s*[一二三四五六七八九十]+\s*[：:\n]',
        r'SCENE\s*\d+',
        r'场景[：:]\s*[^\n]+',
        r'第\s*[一二三四五六七八九十]+\s*场',
    ]

    matches = []
    for pattern in patterns:
        for m in re.finditer(pattern, content, re.IGNORECASE):
            matches.append((m.start(), m.end(), m.group()))

    matches.sort(key=lambda x: x[0])
    return matches


def detect_blank_line_patterns(content: str) -> List[Tuple[int, int, str]]:
    """第三层：空白行模式检测

    检测连续2行以上空行作为分隔点
    """
    # 匹配连续2个以上换行（含空格）
    pattern = r'\n\s*\n\s*\n+'

    matches = []
    for m in re.finditer(pattern, content):
        matches.append((m.start(), m.end(), '\n\n'))

    matches.sort(key=lambda x: x[0])
    return matches


def detect_content_structure(content: str) -> List[Tuple[int, int, str]]:
    """第四层：内容结构检测

    检测对白开始/结束模式变化（简化版）
    """
    # 检测角色名开头模式变化（如 "张三：" 结束后出现新的场景描述）
    pattern = r'[^\n：:]+[：:][^\n]*\n'  # 对白行

    lines = content.split('\n')
    dialogue_starts = []

    for i, line in enumerate(lines):
        if re.match(pattern, line):
            dialogue_starts.append(i)

    # 找到对白密集区域之间的空隙（可能为分集边界）
    matches = []
    prev_dialogue_end = 0

    for i, start in enumerate(dialogue_starts):
        # 如果连续10行以上无对白，可能是分集边界
        if start - prev_dialogue_end > 10:
            pos = sum(len(lines[j]) + 1 for j in range(prev_dialogue_end, start))
            matches.append((pos, pos + 1, 'structure_gap'))
        prev_dialogue_end = start

    return matches


def extract_episode_number(marker_text: str) -> Optional[int]:
    """从标记文本中提取集号数字

    例：'第一集' → 1, 'EP02' → 2, '第3集' → 3
    """
    # 中文数字映射
    chinese_nums = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
                    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
                    '零': 0, '百': 100}

    # 尝试提取阿拉伯数字
    digits = re.findall(r'\d+', marker_text)
    if digits:
        return int(digits[0])

    # 尝试提取中文数字
    chinese = re.findall(r'[一二三四五六七八九十百零]+', marker_text)
    if chinese:
        num_str = chinese[0]
        # 简单处理：十以内的直接映射，十一到十九需要计算
        if len(num_str) == 1:
            return chinese_nums.get(num_str, None)
        elif num_str.startswith('十'):
            if len(num_str) == 1:
                return 10
            elif len(num_str) == 2:
                return 10 + chinese_nums.get(num_str[1], 0)
            else:
                return None
        elif num_str.startswith('二十'):
            return 20 + chinese_nums.get(num_str[2], 0) if len(num_str) > 2 else 20
        # 更复杂的可以后续扩展

    return None


def calculate_split_points(
    content: str,
    layer_results: List[Tuple[int, int, str, DetectionLayer]],
    expected_episodes: Optional[int] = None
) -> List[EpisodeSplitResult]:
    """计算分割点

    核心逻辑修复：
    - 检测到的标记是该集的**起始标记**，内容在标记之后
    - EP01 内容：从"第一集"标记结束位置 → "第二集"标记起始位置
    """
    if not layer_results:
        # 无检测结果，按字数平均分割
        total_chars = len(content)
        avg_chars = total_chars // max(expected_episodes or 10, 1)
        results = []
        pos = 0
        ep_num = 1
        while pos < len(content) and ep_num <= (expected_episodes or 100):
            end_pos = min(pos + avg_chars, len(content))
            preview = content[pos:min(pos + 100, end_pos)]
            results.append(EpisodeSplitResult(
                episode_number=ep_num,
                start_position=pos,
                end_position=end_pos,
                char_count=end_pos - pos,
                confidence=30,
                detection_layer=DetectionLayer.content_structure,
                is_abnormal=True,
                abnormal_reason="无法检测分集标记，按字数分割",
                content_preview=preview.strip()[:100]
            ))
            pos = end_pos
            ep_num += 1
        return results

    # 核心修复：标记是集号起始，内容在标记之后
    results = []
    ep_num = 1

    # 处理第一个标记之前的内容（可能是标题或无关内容）
    first_marker_start = layer_results[0][0]
    if first_marker_start > 50:  # 如果开头有超过50字的无关内容，忽略
        pass  # 不作为第一集，第一集从第一个标记开始

    for i, (start, end, marker, layer) in enumerate(layer_results):
        # 从标记起始位置（含标记行）到下一个标记起始位置（或文件结尾）
        content_start = start  # 该集内容起始位置（包含标记行）

        # 查找下一个标记位置，作为该集内容结束位置
        if i + 1 < len(layer_results):
            content_end = layer_results[i + 1][0]  # 下一个标记的起始位置
        else:
            content_end = len(content)  # 最后一个标记到文件结尾

        # 提取集号（如果标记中有数字）
        extracted_num = extract_episode_number(marker)
        episode_number = extracted_num if extracted_num else ep_num

        char_count = content_end - content_start
        preview = content[content_start:min(content_start + 100, content_end)]

        # 空内容处理（标记相邻）
        if char_count < 100:
            is_abnormal = True
            abnormal_reason = f"内容过短（仅{char_count}字），可能检测错误"
        else:
            is_abnormal = False
            abnormal_reason = None

        results.append(EpisodeSplitResult(
            episode_number=episode_number,
            start_position=content_start,
            end_position=content_end,
            char_count=char_count,
            confidence=LAYER_CONFIDENCE[layer],
            detection_layer=layer,
            is_abnormal=is_abnormal,
            abnormal_reason=abnormal_reason,
            content_preview=preview.strip()[:100]
        ))

        # 如果没有提取到集号，使用递增编号
        if not extracted_num:
            ep_num += 1
        else:
            ep_num = extracted_num + 1

    return results


def validate_splits(
    splits: List[EpisodeSplitResult],
    content: str
) -> List[EpisodeSplitResult]:
    """辅助验证

    字数统计、异常检测、连贯性检测
    """
    if len(splits) < 2:
        return splits

    # 计算字数统计
    char_counts = [s.char_count for s in splits]
    avg_count = statistics.mean(char_counts)
    std_dev = statistics.stdev(char_counts) if len(char_counts) > 1 else 0

    # 标记异常
    validated = []
    gap_positions = []

    for i, split in enumerate(splits):
        is_abnormal = False
        abnormal_reason = None

        # 字数超出平均值±50%
        if split.char_count < avg_count * 0.5:
            is_abnormal = True
            abnormal_reason = f"字数过少（{split.char_count}字），低于平均值的一半"
        elif split.char_count > avg_count * 1.5:
            is_abnormal = True
            abnormal_reason = f"字数过多（{split.char_count}字），超出平均值的50%"

        # 集数编号不连续
        if i > 0 and split.episode_number != splits[i-1].episode_number + 1:
            gap_positions.append(split.episode_number)
            is_abnormal = True
            abnormal_reason = f"集数编号不连续，缺少 EP{split.episode_number - 1}"

        validated.append(EpisodeSplitResult(
            episode_number=split.episode_number,
            start_position=split.start_position,
            end_position=split.end_position,
            char_count=split.char_count,
            confidence=split.confidence,
            detection_layer=split.detection_layer,
            is_abnormal=is_abnormal or split.is_abnormal,
            abnormal_reason=abnormal_reason or split.abnormal_reason,
            content_preview=split.content_preview
        ))

    return validated


async def detect_splits(
    content: str,
    expected_episodes: Optional[int] = None
) -> SplitDetectionResponse:
    """执行多层检测，返回完整检测结果

    主入口函数
    """
    # 执行四层检测
    explicit_matches = detect_explicit_markers(content)
    scene_matches = detect_scene_titles(content)
    blank_matches = detect_blank_line_patterns(content)
    structure_matches = detect_content_structure(content)

    # 优先使用显式标记
    if explicit_matches:
        layer_results = [
            (m[0], m[1], m[2], DetectionLayer.explicit_marker)
            for m in explicit_matches
        ]
    elif scene_matches:
        # 综合场景标题和空白行
        layer_results = [
            (m[0], m[1], m[2], DetectionLayer.scene_title)
            for m in scene_matches
        ]
        # 加入空白行作为补充
        for m in blank_matches:
            if not any(abs(m[0] - lr[0]) < 100 for lr in layer_results):
                layer_results.append((m[0], m[1], m[2], DetectionLayer.blank_line))
        layer_results.sort(key=lambda x: x[0])
    else:
        # 使用空白行和内容结构
        layer_results = [
            (m[0], m[1], m[2], DetectionLayer.blank_line)
            for m in blank_matches
        ]
        for m in structure_matches:
            if not any(abs(m[0] - lr[0]) < 200 for lr in layer_results):
                layer_results.append((m[0], m[1], m[2], DetectionLayer.content_structure))
        layer_results.sort(key=lambda x: x[0])

    # 计算分割点
    splits = calculate_split_points(content, layer_results, expected_episodes)

    # 辅助验证
    validated_splits = validate_splits(splits, content)

    # 构建响应
    total_chars = len(content)
    avg_confidence = statistics.mean([s.confidence for s in validated_splits]) if validated_splits else 0
    avg_char_count = statistics.mean([s.char_count for s in validated_splits]) if validated_splits else 0
    has_gaps = any(s.is_abnormal and s.abnormal_reason and "不连续" in s.abnormal_reason for s in validated_splits)
    gap_positions = [s.episode_number for s in validated_splits if s.is_abnormal and s.abnormal_reason and "不连续" in s.abnormal_reason]

    return SplitDetectionResponse(
        results=validated_splits,
        total_episodes=len(validated_splits),
        total_chars=total_chars,
        avg_confidence=avg_confidence,
        avg_char_count=avg_char_count,
        has_gaps=has_gaps,
        gap_positions=gap_positions
    )