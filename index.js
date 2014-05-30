// index.js
'use strict';

$(function () {

	var dbInfo;
	var dbName;
	var labelRowCount;

	$('#pairs, #submit, #objects, #response').hide();
	$.ajax({
		url: '/ajax',
		data: JSON.stringify({cmd:'getinfo'}),
		dataType: 'text',
		processData: false,
		type: 'POST'
	}).done(function (data) {
		dbInfo = JSON.parse(data);
		Object.keys(dbInfo).forEach(function (name) {
			var text = name + (dbInfo[name].readOnly ?
							   ' (read only)' : ' (read/write)');
			$('#dbInfo').append('<option value="' + name + '">'
								+ text + '</option>');
		});
		if ($('#dbInfo option').length === 2) {
			$('#dbInfo option').get(0).remove();
			dbName = $('#dbInfo').get(0).value;
			if (dbInfo[dbName].readOnly) {
				$('#put, #remove').hide();
			} else {
				$('#put, #remove').show();
			}
			getKeys();
		}
	}).fail(function (jqXHR, error) {
		alert(error);
		return;
	});

	$('#dbInfo').change(function () {
		$('#pairs, #submit, #objects, #response').hide();
		$('tbody.pairs tr').remove();
		$('#count').remove();
		$('tbody.objects tr').remove();
		$('tbody.response tr').remove();
		if ($(this).get(0).selectedIndex !== 0) {
			dbName = $(this).get(0).value;
			if (dbInfo[dbName].readOnly) {
				$('#put, #remove').hide();
			} else {
				$('#put, #remove').show();
			}
			getKeys();
		}
	});

	function getKeys() {
		dbInfo[dbName].keys.forEach(function (key) {
			var row = $('tbody.pairs').get(0).insertRow(-1);
			$(row).append('<td class="right"><label>' + key + '</label>:</td>'
						  + '<td><input type="text" size="20"></td>'
						  + '<td><input type="checkbox"></td>');
		});
		labelRowCount = $('tbody.pairs tr').length;
		dynamicTable();
		$('#pairs').show();
		$('tbody.pairs input[type="text"]').eq(0).focus();
	}

	$('tbody.pairs').eq(0).keydown(function (event) {
		if (event.which === 13 && $('#submit').css('display') !== 'none') {
			event.preventDefault();
			$('#submit').click();
		} else if (event.which === 9) {
			var current = $(event.target).attr('tabIndex') - 1;
			if (event.shiftKey) {
				if (--current < 0) {
					current = $('tbody.pairs input[type="text"]').length - 1;
				}
			} else if (++current === $('tbody.pairs input[type="text"]').length) {
				current = 0;
			}
			$('tbody.pairs input[type="text"]').eq(current).focus().get(0).select();
			event.preventDefault();
		}
	}).keyup(function (event) {
		if (event.which !== 9) {
			dynamicTable();
		}
	});

	$('#submit').click(function () {
		var object = {};
		$('tbody.pairs tr').each(function (index, row) {
			if (index < labelRowCount) {
				var key = $(row).find('label').eq(0).text();
				var value = $(row).find('input').eq(0).val().trim();
				var exact = $(row).find('input').get(1).checked;
			} else {
				key = $(row).find('input').eq(0).val().trim();
				value = $(row).find('input').eq(1).val().trim();
				exact = $(row).find('input').get(2).checked;
			}
			if (key && value) {
				if (exact) {
					value = value + '_';
				}
				object[key] = value;
			}
		});
		var row = $('tbody.objects').get(0).insertRow(-1);
		$(row).append('<td><button type="button" class="edit">Edit</button></td>'
					  + '<td>' + JSON.stringify(object) + '</td>'
					  + '<td><button type="button" class="clear">Clear</button></td>');
		setTabIndex();
		$('#objects').show();
		$('tbody.pairs input[type="text"]').eq(0).focus().get(0).select();
	});

	$('tbody.objects').eq(0).click(function (event) {
		if ($(event.target).hasClass('edit')) {
			edit(event);
		}
		$(event.target).closest('tr').remove();
		if ($('tbody.objects tr').length === 0) {
			$('#objects').hide();
			$('#response').hide();
			$('#count').remove();
			$('tbody.response tr').remove();
		}
		$('tbody.pairs input[type="text"]').eq(0).focus().get(0).select();
	});

	function edit(event) {
		var object = JSON.parse($(event.target).closest('tr')
								.find('td').eq(1).text());
		var keys = [];
		$('tbody.pairs tr').each(function (index, row) {
			if (index < labelRowCount) {
				keys.push($(row).find('label').eq(0).text());
				$(row).find('input').eq(0).val('');
				$(row).find('input').get(1).checked = false;
			} else {
				$(row).remove();
			}
		});
		Object.keys(object).forEach(function (key) {
			var value = object[key];
			var nrow = keys.indexOf(key);
			if (nrow === -1) {
				var row = newRow();
				$(row).find('input').eq(0).val(key);
				if (value.slice(-1) === '_') {
					$(row).find('input').get(2).checked = true;
					value = value.slice(0, -1);
				}
				$(row).find('input').eq(1).val(value);
 			} else {
				row = $('tbody.pairs tr').eq(nrow);
				if (value.slice(-1) === '_') {
					$(row).find('input').get(1).checked = true;
					value = value.slice(0, -1);
				}
				$(row).find('input').eq(0).val(value);
			}
		});
		if (!dbInfo[dbName].readOnly) {
			newRow();
		}
		setTabIndex();
	}

	$('#clear').click(function () {
		$('#count').remove();
		$('tbody.response tr').remove();
		$('#response').hide();
		$('tbody.pairs input[type="text"]').eq(0).focus().get(0).select();
	});

	$('#get').click(function () {
		send('get');
	});

	$('#put').click(function () {
		send('put');
	});

	$('#remove').click(function () {
		send('remove');
	});

	function send(cmd) {
		$('#count').remove();
		$('tbody.response tr').remove();
		var array = [];
		$('tbody.objects tr').each(function () {
			array.push(JSON.parse($(this).children('td').eq(1).text()));
		});
		var object = {};
		object.cmd = cmd;
		object.dbName = dbName;
		object.args = array;
		$.ajax({
			url: '/ajax',
			data: JSON.stringify(object),
			dataType: 'text',
			processData: false,
			type: 'POST'
		}).done(function (data) {
			var array = JSON.parse(data);
			var count = array.length;
			$('thead.response')
				.append('<tr id="count"><th>' + count + ' object'
						+ (count === 1 ? '' : 's') + '</th></tr>')
			var object;
			while ((object = array.shift()) !== undefined) {
				var row = $('tbody.response').get(0).insertRow(-1);
				$(row).append('<td>' + JSON.stringify(object) + '</td>');
			}
			$('#response').show();
			$('tbody.pairs input[type="text"]').eq(0).focus().get(0).select();
		}).fail(function (jqXHR, error) {
			alert(error);
			return;
		});
	}

	function dynamicTable() {
		if (!dbInfo[dbName].readOnly) {
			var rows = $('tbody.pairs tr');
			var current = $(document.activeElement).attr('tabIndex') - 1;
			for (var nrow = labelRowCount; nrow < $(rows).length; ++nrow) {
				var row = $(rows).eq(nrow);
				var emptyCount = 0;
				for (var col = 0; col < 2; ++col) {
					if ($(row).find('input').eq(col).val().trim() === '') {
						++emptyCount;
					}
				}
				if (emptyCount === 2) {
					$(row).remove();
				}
			}
			newRow();
		}
		setTabIndex();
		$('input[type="text"]').eq(current).focus();
	}

	function newRow() {
		var row = $('tbody.pairs').get(0).insertRow(-1);
		$(row).append('<td><input type="text" size="10" class="right">:</td>'
					  + '<td><input type="text" size="20"></td>'
					  + '<td><input type="checkbox"></td>');
		return row;
	}

	function setTabIndex() {
		$('#submit').hide();
		var tabIndex = 0;
		$('tbody.pairs tr').each(function (rowIndex) {
			var need = rowIndex < labelRowCount ? 1 : 2;
			$(this).find('input[type="text"]').each(function (inputIndex) {
				$(this).attr('tabIndex', ++tabIndex);
				if ($(this).val().trim() !== '' && --need === 0) {
					$('#submit').show();
				}
			});
		});
	}

});
