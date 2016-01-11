// index.js
'use strict';

$(function () {

	var dbInfo;
	var dbName;
	var labelRowCount;

	var checkedChar = String.fromCharCode(0x2611);
	var uncheckedChar = String.fromCharCode(0x25fb);

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
		$('tbody.pairs tr, tbody.objects tr, #count, tbody.response tr').remove();
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
						  + '<td><input type="checkbox" class="checkbox"></td>');
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

	$('tbody.pairs').focusout(function (event) {
		if (!$(event.target).hasClass('checkbox')) {
			var content = $(event.target).val().replace(/[  ]+/g, ' ').trim();
			if ($(event.target).hasClass('right')) {
				$(event.target).val(content.toLowerCase());
			} else {
				$(event.target).val(content);
			}
		}
	});

	$('#submit').click(function () {
		var obj = {};
		$('tbody.pairs tr').each(function (index, row) {
			var key = index < labelRowCount
				? $(row).find('label').eq(0).text().trim()
				: $(row).find('input[type="text"]').eq(0).val();
			var value = $(row).find('input[type="text"]').eq(-1).val();
			var exact = $(row).find('input[type="checkbox"]').get(0).checked;
			if (key !== '' && value !== '') {
				obj[key] = value + (exact ? checkedChar : uncheckedChar);
			}
		});
		var object = {};
		Object.keys(obj).sort().forEach(function (key) {
			object[key] = obj[key];
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
		if ($(event.target).hasClass('edit')
			|| $(event.target).hasClass('clear')) {
			if ($(event.target).hasClass('edit')) {
				edit(event);
			}
			$(event.target).closest('tr').remove();
			if ($('tbody.objects tr').length === 0) {
				$('#objects, #response').hide();
				$('#count, tbody.response tr').remove();
			}
			$('tbody.pairs input[type="text"]').eq(0).focus().get(0).select();
		}

		function edit(event) {
			var object = JSON.parse($(event.target).closest('tr')
									.find('td').eq(1).text());
			var keys = [];
			$('tbody.pairs tr').each(function (index, row) {
				if (index < labelRowCount) {
					keys.push($(row).find('label').eq(0).text().trim());
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
					$(row).find('input[type="text"]').eq(0).val(key);
				} else {
					row = $('tbody.pairs tr').eq(nrow);
				}
				$(row).find('input[type="text"]').eq(-1).val(value.slice(0, -1));
				$(row).find('input[type="checkbox"]').get(0).checked =
					value.substr(-1) === checkedChar;
			});
			if (!dbInfo[dbName].readOnly) {
				newRow();
			}
			setTabIndex();
		}
	});

	$('#clear').click(function () {
		$('#response').hide();
		$('#count, tbody.response tr').remove();
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
		$('#count, tbody.response tr').remove();
		var array = [];
		$('tbody.objects tr').each(function () {
			var obj = JSON.parse($(this).children('td').eq(1).text());
			Object.keys(obj).forEach(function (key) {
				if (cmd === 'put') {
					var exact = '';
				} else {
					exact = obj[key].substr(-1) === checkedChar ? '=' : '~';
				}
				obj[key] = obj[key].slice(0, -1) + exact;
			});
			array.push(obj);
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
			while (object = array.shift()) {
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
				var inputs = $(row).find('input');
				if ($(inputs).eq(0).val().trim() === ''
					&& $(inputs).eq(-2).val().trim() === ''
					&& !$(inputs).get(-1).checked) {
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
					  + '<td><input type="checkbox" class="checkbox"></td>');
		return row;
	}

	function setTabIndex() {
		$('#submit').hide();
		$('tbody.pairs tr').each(function () {
			var inputs = $(this).find('input[type="text"]');
			if ($(inputs).eq(-1).val().trim() !== ''
				&& (($(inputs)).length === 1
					|| $(inputs).eq(0).val().trim() !== '')) {
				$('#submit').show();
			}
		});
		var tabIndex = 0;
		$('tbody.pairs input[type="text"]').each(function () {
			$(this).attr('tabIndex', ++tabIndex);
		});
	}

});
