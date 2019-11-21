'use strict';

goog.provide('Blockly.ODF');
goog.require('Blockly.Generator');

Blockly.ODF = new Blockly.Generator('ODF');
Blockly.ODF.ORDER_LITERAL = 0;          // 0 "" ...
Blockly.ODF.ORDER_NONE = 99;            // (...)

function getVariableName(block, variable) {
  return block.workspace.getVariableById(block.getFieldValue(variable)).name;
}

function indent(code, depth = 4) {
  return code.replace(/^(.*)$/mg, ' '.repeat(depth) + '$1')
}

//TODO: load from template
const template =
  'import de.opendiabetes.vault.data.container.VaultEntry;\n' +
  'import de.opendiabetes.vault.data.container.VaultEntryType;\n' +
  'import de.opendiabetes.vault.processing.*;\n' +
  'import de.opendiabetes.vault.processing.filter.*;\n' +
  'import de.opendiabetes.vault.processing.filter.options.*;\n' +
  'import de.opendiabetes.vault.processing.manipulator.*;\n' +
  'import de.opendiabetes.vault.processing.manipulator.options.*;\n' +
  'import de.opendiabetes.vault.util.VaultEntryUtils;\n' +
  'import java.time.LocalTime;\n' +
  'import java.util.ArrayList;\n' +
  'import java.util.Arrays;\n' +
  'import java.util.Date;\n' +
  'import java.util.List;\n' +
  'import java.util.Map;\n' +
  '\n' +
  'public class Process implements ProcessingContainer {\n' +
  '    @Override\n' +
  '    public List<List<VaultEntry>> processData(List<List<VaultEntry>> inputData) {\n' +
  '        List<List<VaultEntry>> results = new ArrayList<>();\n' +
  '\n' +
  '        for (List<VaultEntry> slice : inputData) {\n' +
  '%FILTER%\n' +
  '        }\n' +
  '\n' +
  '        return results;\n' +
  '    }\n' +
  '\n' +
  '    private FilterResult normalizeTimeSeries(FilterResult result, int minutes) {\n' +
  '        List<Map.Entry<Date, Date>> newSeries = new ArrayList<>();\n' +
  '        for (Map.Entry<Date, Date> entry : result.timeSeries) {\n' +
  '            if (newSeries.isEmpty()) {\n' +
  '                newSeries.add(entry);\n' +
  '            } else {\n' +
  '                Map.Entry<Date, Date> last = newSeries.get(newSeries.size() - 1);\n' +
  '                if (entry.getKey().getTime() - last.getValue().getTime() <= minutes * 60 * 1000) {\n' +
  '                    last.setValue(entry.getValue());\n' +
  '                } else {\n' +
  '                    newSeries.add(entry);\n' +
  '                }\n' +
  '            }\n' +
  '        }\n' +
  '        return new FilterResult(result.filteredData, newSeries);\n' +
  '    }\n' +
  '}\n';

Blockly.ODF['main'] = function (block) {
  let code = '';
  const normalize = block.getFieldValue('NORMALIZE');
  if (template !== undefined) {
    code = [];
    let filter = block.getInputTargetBlock('FILTER');
    while (filter != null) {
      let filterCode =
        'Filter filter = ' + Blockly.ODF.blockToCode(filter) + ';\n' +
        'System.out.println("Filtering " + slice.size() + " entries");\n' +
        'FilterResult result = filter.filter(slice);\n' +
        'System.out.println("Filter returned " + result.filteredData.size() + " entries");\n';

      if (normalize > 0)
        filterCode += 'result = normalizeTimeSeries(result, ' + normalize + ');\n';

      filterCode +=
        'results.addAll(VaultEntryUtils.getDataFromFilterResult(result));';
      code.push(indent('{\n' + indent(filterCode) + '\n}', 12));
      filter = filter.getNextBlock();
    }
    code = template.replace('%FILTER%', code.join('\n'));
  }

  return code;
};

Blockly.ODF['value_vaultentrytype'] = function (block) {
  const code = 'VaultEntryType.' + block.getFieldValue('TYPE');
  return [code, Blockly.ODF.ORDER_NONE];
};

Blockly.ODF['value_datetime'] = function (block) {
  const year = block.getFieldValue('YEAR');
  const month = block.getFieldValue('MONTH');
  const day = block.getFieldValue('DAY');
  const hour = block.getFieldValue('HOUR');
  const minute = block.getFieldValue('MINUTE');
  const second = block.getFieldValue('SECOND');
  const code = 'new Date(' + Date.UTC(year, month - 1, day, hour, minute, second) + 'L)';
  return [code, Blockly.ODF.ORDER_NONE];
};

Blockly.ODF['value_localtime'] = function (block) {
  const hour = block.getFieldValue('HOUR');
  const minute = block.getFieldValue('MINUTE');
  const second = block.getFieldValue('SECOND');
  const code = 'LocalTime.of(' + hour + ', ' + minute + ', ' + second + ')';
  return [code, Blockly.ODF.ORDER_NONE];
};

// FILTERS

Blockly.ODF['filter_and'] = function (block) {
  let filters = block.getInputTargetBlock('FILTERS');
  const subCode = [];
  while (filters != null) {
    subCode.push(Blockly.ODF.blockToCode(filters));
    filters = filters.getNextBlock();
  }
  return 'new AndFilter(new AndFilterOption(Arrays.asList(\n' + indent(subCode.join(',\n')) + '\n)))';
};

Blockly.ODF['filter_cluster'] = function (block) {
  const type = Blockly.ODF.valueToCode(block, 'TYPE', Blockly.ODF.ORDER_LITERAL) || 'null';
  return 'new ClusterFilter(new ClusterFilterOption(' + type + '))';
};

Blockly.ODF['filter_combination'] = function (block) {
  const first = Blockly.ODF.blockToCode(block.getInputTargetBlock('FIRST'));
  const second = Blockly.ODF.blockToCode(block.getInputTargetBlock('SECOND'));
  return 'new CombinationFilter(new CombinationFilterOption(slice,\n' + indent(first) + ',\n' + indent(second) + '\n))';
};

Blockly.ODF['filter_compactquery'] = function (block) {
  let filters = block.getInputTargetBlock('FILTERS');
  const subCode = [];
  while (filters != null) {
    subCode.push(Blockly.ODF.blockToCode(filters));
    filters = filters.getNextBlock();
  }
  return 'new CompactQueryFilter(new CompactQueryFilterOption(Arrays.asList(\n' + indent(subCode.join(',\n')) + '\n)))';
};

Blockly.ODF['filter_continouswrapper'] = function (block) {
  const before = block.getFieldValue('MARGIN_BEFORE');
  const after = block.getFieldValue('MARGIN_AFTER');
  return 'new ContinuousWrapperFilter(new ContinuousWrapperFilterOption(slice, ' + before + ', ' + after + '))';
};

Blockly.ODF['filter_counter'] = function (block) {
  const filter = Blockly.ODF.blockToCode(block.getInputTargetBlock('FILTER'));
  const hitCounter = block.getFieldValue('HITCOUNTER');
  const onlyOne = block.getFieldValue('ONLYONE').toLowerCase();

  return 'new CounterFilter(new CounterFilterOption(\n' + indent(filter) + ',\n' + hitCounter + ', ' + onlyOne + '))';
};

Blockly.ODF['filter_datasetmarker'] = function (block) {
  return 'new DatasetMarker()';
};

Blockly.ODF['filter_datetimepoint'] = function (block) {
  const date = Blockly.ODF.valueToCode(block, 'DATE', Blockly.ODF.ORDER_LITERAL) || 'null';
  const before = block.getFieldValue('MARGIN_BEFORE');
  const after = block.getFieldValue('MARGIN_AFTER');
  return 'new DateTimePointFilter(new DateTimePointFilterOption(' + date + ', ' + before + ', ' + after + '))';
};

Blockly.ODF['filter_datetimespan'] = function (block) {
  const start = Blockly.ODF.valueToCode(block, 'START', Blockly.ODF.ORDER_LITERAL) || 'null';
  const end = Blockly.ODF.valueToCode(block, 'END', Blockly.ODF.ORDER_LITERAL) || 'null';
  return 'new DateTimeSpanFilter(new DateTimeSpanFilterOption(' + start + ', ' + end + '))';
};

Blockly.ODF['filter_elevation'] = function (block) {
  const type = Blockly.ODF.valueToCode(block, 'TYPE', Blockly.ODF.ORDER_NONE) || 'null';
  const minElevation = block.getFieldValue('MIN_ELEVATION');
  const minutesBetween = block.getFieldValue('MINUTES_BETWEEN');
  return 'new ElevationFilter(new ElevationFilterOption(' + type + ', ' + minElevation + ', ' + minutesBetween + '))';
};

Blockly.ODF['filter_elevation_point'] = function (block) {
  const type = Blockly.ODF.valueToCode(block, 'TYPE', Blockly.ODF.ORDER_NONE) || 'null';
  const minElevation = block.getFieldValue('MIN_ELEVATION');
  const minutesBetween = block.getFieldValue('MINUTES_BETWEEN');
  return 'new ElevationPointFilter(new ElevationPointFilterOption(' + type + ', ' + minElevation + ', ' + minutesBetween + '))';
};

Blockly.ODF['filter_filterhitcounter'] = function (block) {
  const filter = Blockly.ODF.blockToCode(block.getInputTargetBlock('FILTER'));
  const min = block.getFieldValue('MIN');
  const max = block.getFieldValue('MAX');
  const none = block.getFieldValue('NONE').toLowerCase();

  return 'new FilterHitCounterFilter(new FilterHitCounterFilterOption(\n' + indent(filter) + ',\n' + min + ', ' + max + ', ' + none + '))';
};

Blockly.ODF['filter_gapremover'] = function (block) {
  const type = Blockly.ODF.valueToCode(block, 'TYPE', Blockly.ODF.ORDER_NONE) || 'null';
  const time = block.getFieldValue('TIME');
  return 'new GapRemoverFilter(new GapRemoverFilterOption(' + type + ', ' + time + '))';
};

Blockly.ODF['filter_inbetween'] = function (block) {
  const type = Blockly.ODF.valueToCode(block, 'TYPE', Blockly.ODF.ORDER_NONE) || 'null';
  const min = block.getFieldValue('MIN');
  const max = block.getFieldValue('MAX');
  const normalize = block.getFieldValue('NORMALIZE').toLowerCase();
  return 'new InBetweenFilter(new InBetweenFilterOption(' + type + ', ' + min + ', ' + max + ', ' + normalize + '))';
};

Blockly.ODF['filter_interpolation'] = function (block) {
  const type = Blockly.ODF.valueToCode(block, 'TYPE', Blockly.ODF.ORDER_NONE) || 'null';
  const between = block.getFieldValue('BETWEEN');
  return 'new InterpolationFilter(new InterpolationFilterOption(' + type + ', ' + between + '))';
};

Blockly.ODF['filter_logic'] = function (block) {
  let filters = block.getInputTargetBlock('FILTERS');
  const subCode = [];
  while (filters != null) {
    subCode.push(Blockly.ODF.blockToCode(filters));
    filters = filters.getNextBlock();
  }
  const onlyOne = block.getFieldValue('ONLYONE').toLowerCase();
  return 'new LogicFilter(new LogicFilterOption(Arrays.asList(\n' + indent(subCode.join(',\n')) + '\n), ' + onlyOne + '))';
};

Blockly.ODF['filter_negate'] = function (block) {
  const filter = Blockly.ODF.blockToCode(block.getInputTargetBlock('FILTER'));
  return 'new NegateFilter(new NegateFilterOption(\n' + indent(filter) + '\n))';
};

Blockly.ODF['filter_nonetype'] = function (block) {
  const type = Blockly.ODF.valueToCode(block, 'TYPE', Blockly.ODF.ORDER_NONE) || 'null';
  return 'new NoneTypeFilter(new NoneTypeFilterOption(' + type + '))';
};

Blockly.ODF['filter_or'] = function (block) {
  let filters = block.getInputTargetBlock('FILTERS');
  const subCode = [];
  while (filters != null) {
    subCode.push(Blockly.ODF.blockToCode(filters));
    filters = filters.getNextBlock();
  }
  return 'new OrFilter(new OrFilterOption(Arrays.asList(\n' + indent(subCode.join(',\n')) + '\n)))';
};

Blockly.ODF['filter_position'] = function (block) {
  const filter = Blockly.ODF.blockToCode(block.getInputTargetBlock('FILTER'));
  const mode = 'PositionFilterOption.' + block.getFieldValue('MODE');
  const type = Blockly.ODF.valueToCode(block, 'TYPE', Blockly.ODF.ORDER_NONE) || 'null';
  return 'new PositionFilter(new PositionFilterOption(\n' + indent(filter) + ',\n' + mode + ', ' + type + '))';
};

Blockly.ODF['filter_query'] = function (block) {
  const main = Blockly.ODF.blockToCode(block.getInputTargetBlock('FILTER_MAIN'));
  const inner = Blockly.ODF.blockToCode(block.getInputTargetBlock('FILTER_INNER'));
  const min = block.getFieldValue('MIN');
  const max = block.getFieldValue('MAX');
  return 'new QueryFilter(new QueryFilterOption(\n' + indent(main) + ',\n' + indent(inner) + ',\n' + min + ', ' + max + '))';
};

Blockly.ODF['filter_standardize'] = function (block) {
  const type = Blockly.ODF.valueToCode(block, 'TYPE', Blockly.ODF.ORDER_NONE) || 'null';
  const between = block.getFieldValue('BETWEEN').toLowerCase();
  return 'new StandardizeFilter(new StandardizeFilterOption(' + type + ', ' + between + '))';
};

Blockly.ODF['filter_threshold'] = function (block) {
  const min = block.getFieldValue('MIN');
  const max = block.getFieldValue('MAX');
  const mode = 'ThresholdFilterOption.' + block.getFieldValue('MODE');
  return 'new ThresholdFilter(new ThresholdFilterOption(' + min + ', ' + max + ', ' + mode + '))';
};

Blockly.ODF['filter_timecluster'] = function (block) {
  let filters = block.getInputTargetBlock('FILTERS');
  const subCode = [];
  while (filters != null) {
    subCode.push(Blockly.ODF.blockToCode(filters));
    filters = filters.getNextBlock();
  }
  const startTime = Blockly.ODF.valueToCode(block, 'STARTTIME', Blockly.ODF.ORDER_NONE) || 'null';
  const minutes = block.getFieldValue('MINUTES');
  const spacing = block.getFieldValue('SPACING');
  return 'new TimeClusterFilter(new TimeClusterFilterOption(Arrays.asList(\n' +
    indent(subCode.join(',\n')) + '),\n' + startTime + ', ' + minutes + ', ' + spacing + '))';
};

Blockly.ODF['filter_timepoint'] = function (block) {
  const time = Blockly.ODF.valueToCode(block, 'TIME', Blockly.ODF.ORDER_LITERAL) || 'null';
  const before = block.getFieldValue('MARGIN_BEFORE');
  const after = block.getFieldValue('MARGIN_AFTER');
  return 'new TimePointFilter(new TimePointFilterOption(' + time + ', ' + before + ', ' + after + '))';
};

Blockly.ODF['filter_timespan'] = function (block) {
  const start = Blockly.ODF.valueToCode(block, 'START', Blockly.ODF.ORDER_LITERAL) || 'null';
  const end = Blockly.ODF.valueToCode(block, 'END', Blockly.ODF.ORDER_LITERAL) || 'null';
  return 'new TimeSpanFilter(new TimeSpanFilterOption(' + start + ', ' + end + '))';
};

Blockly.ODF['filter_typeabsence'] = function (block) {
  const type = Blockly.ODF.valueToCode(block, 'TYPE', Blockly.ODF.ORDER_NONE) || 'null';
  const margin = block.getFieldValue('MARGIN');
  return 'new TypeAbsenceFilter(new TypeAbsenceFilterOption(' + type + ', ' + margin + 'L))';
};

Blockly.ODF['filter_valuemover'] = function (block) {
  const type = Blockly.ODF.valueToCode(block, 'TYPE', Blockly.ODF.ORDER_NONE) || 'null';
  const value = block.getFieldValue('VALUE');
  const isAdd = block.getFieldValue('ISADD').toLowerCase();
  return 'new ValueMoverFilter(new ValueMoverFilterOption(' + type + ', ' + value + ', ' + isAdd + '))';
};

Blockly.ODF['filter_vaultentrytypecounter'] = function (block) {
  const type = Blockly.ODF.valueToCode(block, 'TYPE', Blockly.ODF.ORDER_NONE) || 'null';
  const min = block.getFieldValue('MIN');
  const max = block.getFieldValue('MAX');
  const none = block.getFieldValue('NONE').toLowerCase();
  return 'new VaultEntryTypeCounterFilter(new VaultEntryTypeCounterFilterOption(' + type + ', ' + min + ', ' + max + ', ' + none + '))';
};

Blockly.ODF['filter_vaultentrytype'] = function (block) {
  const type = Blockly.ODF.valueToCode(block, 'TYPE', Blockly.ODF.ORDER_NONE) || 'null';
  return 'new VaultEntryTypeFilter(new VaultEntryTypeFilterOption(' + type + '))';
};
